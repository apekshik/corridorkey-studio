"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useDirtyStore } from "../stores/useDirtyStore";

/**
 * Ties the Convex project's `settings` blob to the client's
 * `useSettingsStore`. On mount / project change:
 *   1. Hydrate the store from `project.settings` (without marking dirty).
 *   2. Subscribe to subsequent changes and mark dirty.
 *   3. Expose a `save()` callback that mutates Convex and clears dirty.
 *
 * Relying on a hydrating-ref flag keeps the hydrate path from firing
 * `markDirty` spuriously — zustand subscribers fire synchronously, so a
 * plain boolean guard is safe here.
 */
export function useProjectSettings(
  projectId: Id<"projects">,
  project: Doc<"projects"> | null | undefined
) {
  const saveMutation = useMutation(api.projects.saveSettings);
  const hydratingRef = useRef(false);

  // Subscribe once — the listener checks the current project via the
  // captured `projectId` and skips if the hydrating flag is set.
  useEffect(() => {
    let prev = useSettingsStore.getState();
    const unsub = useSettingsStore.subscribe((state) => {
      const changed =
        state.inferenceParams !== prev.inferenceParams ||
        state.outputConfig !== prev.outputConfig;
      prev = state;
      if (!changed) return;
      if (hydratingRef.current) return;
      useDirtyStore.getState().markDirty();
    });
    return unsub;
  }, []);

  // Hydrate whenever the loaded project's settings change. Undefined
  // means the query is still pending — keep the current store state.
  useEffect(() => {
    if (!project) return;
    hydratingRef.current = true;
    const s = project.settings;
    if (s) {
      useSettingsStore.setState({
        inferenceParams: { ...s.inferenceParams },
        outputConfig: { ...s.outputConfig },
      });
      useDirtyStore.getState().reset(s.lastSavedAt);
    } else {
      useDirtyStore.getState().reset(null);
    }
    // Give React a microtask window to flush before re-arming the
    // subscriber — otherwise the setState above would itself be seen as
    // a dirty change.
    queueMicrotask(() => {
      hydratingRef.current = false;
    });
  }, [project?._id, project?.settings]);

  const save = useCallback(async () => {
    const { inferenceParams, outputConfig } = useSettingsStore.getState();
    try {
      const lastSavedAt = await saveMutation({
        projectId,
        inferenceParams,
        outputConfig,
      });
      useDirtyStore.getState().markClean(lastSavedAt);
    } catch (err) {
      console.error("[save settings] failed:", err);
    }
  }, [projectId, saveMutation]);

  return { save };
}
