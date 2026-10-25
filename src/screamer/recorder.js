/**
 * @file recorder.js
 * @description Webcam reaction video recording service for DAWlloween.
 * Captures a 2-second video clip of the player's scare reaction using the native
 * HTML5 MediaRecorder API (video/webm with mp4 fallback) upon jumpscare trigger.
 * Maintains zero local persistence (in-memory Blob and object URL only).
 * Standards: UK English (en-GB), Zero local persistence.
 */

import { cameraService } from './camera.js';
import { captureService } from './capture.js';
import { eventBus } from '../utils/eventBus.js';
import { SCREAMER_CONFIG } from '../config.js';

/**
 * Default duration in milliseconds for reaction clip recording.
 * Sourced centrally from SCREAMER_CONFIG in src/config.js.
 * @constant {number}
 */
export const DEFAULT_RECORDING_DURATION_MS = SCREAMER_CONFIG.durationMs;

/**
 * Detects the best supported video MIME type in the current client browser environment.
 *
 * @returns {string} Target MIME format string.
 */
export function getSupportedVideoMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'video/webm';
  }

  const preferredCandidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4'
  ];

  for (const candidate of preferredCandidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return 'video/webm';
}

/**
 * ReactionRecorderService managing timed webcam clip recordings during jumpscares.
 */
export class ReactionRecorderService {
  /**
   * Initialises the recorder service with clean in-memory state.
   */
  constructor() {
    /** @type {MediaRecorder|null} */
    this.mediaRecorder = null;

    /** @type {Blob[]} Array of recorded binary chunks */
    this.recordedChunks = [];

    /** @type {Blob|null} Complete video blob in memory */
    this.currentVideoBlob = null;

    /** @type {string|null} Local object URL for previewing the blob */
    this.currentVideoUrl = null;

    /** @type {string} MIME format of the recorded video */
    this.recordedMimeType = 'video/webm';

    /** @type {boolean} Recording activity flag */
    this.isRecording = false;

    /** @type {boolean} Media processing flag (waiting for onstop and blob generation) */
    this.isProcessing = false;

    /** @type {Function[]} Resolvers awaiting asynchronous stop completion */
    this.stopResolvers = [];

    /** @type {number|null} Scheduled stop timer handle */
    this.recordingTimeoutId = null;

    /** @type {Function|null} EventBus trigger unsubscribe handle */
    this.unsubscribeTrigger = null;

    /** @type {string|null} Fallback static photo data URL if video recording fails */
    this.fallbackSnapshotUrl = null;
  }

  /**
   * Verifies whether MediaRecorder is supported by the client browser.
   *
   * @returns {boolean} True if MediaRecorder is available.
   */
  isSupported() {
    return typeof MediaRecorder !== 'undefined';
  }

  /**
   * Checks whether recording or media encoding is currently pending/processing.
   *
   * @returns {boolean} True if actively recording or processing chunks into a Blob.
   */
  isPending() {
    return this.isRecording || this.isProcessing;
  }

  /**
   * Starts a 2-second webcam video clip recording.
   * If MediaRecorder is unsupported or no active stream exists, falls back gracefully to a photo snapshot.
   *
   * @param {Object} [options={}] - Recording configuration.
   * @param {MediaStream|null} [options.stream=null] - Explicit MediaStream instance.
   * @param {number} [options.durationMs=DEFAULT_RECORDING_DURATION_MS] - Duration in milliseconds.
   * @returns {boolean} True if recording started, false if fallback was engaged.
   */
  startRecording({
    stream = null,
    durationMs = DEFAULT_RECORDING_DURATION_MS
  } = {}) {
    const activeStream = stream || (cameraService ? cameraService.getStream() : null);

    // If MediaRecorder is not supported or no stream is available, engage photo fallback
    if (!this.isSupported() || !activeStream || (typeof activeStream.active === 'boolean' && !activeStream.active)) {
      this.engageFallback('Stream inactive or MediaRecorder unsupported');
      return false;
    }

    try {
      this.clearRecording();
      this.recordedChunks = [];
      this.recordedMimeType = getSupportedVideoMimeType();

      this.mediaRecorder = new MediaRecorder(activeStream, {
        mimeType: this.recordedMimeType
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event && event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finaliseRecording(durationMs);
      };

      this.mediaRecorder.onerror = (error) => {
        console.warn('[ReactionRecorderService] MediaRecorder error, falling back to snapshot:', error);
        this.engageFallback('MediaRecorder execution error');
      };

      this.isRecording = true;
      this.mediaRecorder.start(100); // Request chunks every 100ms for responsiveness

      // Schedule exact stop after duration
      const scheduleTimer = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
        ? window.setTimeout
        : (typeof setTimeout === 'function' ? setTimeout : null);

      if (scheduleTimer) {
        this.recordingTimeoutId = scheduleTimer(() => {
          this.stopRecording();
        }, durationMs);
      }

      return true;
    } catch (error) {
      console.warn('[ReactionRecorderService] Failed to initialise MediaRecorder:', error);
      this.engageFallback('Initialisation exception');
      return false;
    }
  }

  /**
   * Finalises the recording process, creating the video Blob and local Object URL.
   *
   * @param {number} durationMs - Expected recording duration in milliseconds.
   */
  finaliseRecording(durationMs) {
    this.isRecording = false;
    this.isProcessing = false;

    if (this.recordedChunks.length > 0) {
      try {
        const videoBlob = new Blob(this.recordedChunks, { type: this.recordedMimeType });
        this.currentVideoBlob = videoBlob;

        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          this.currentVideoUrl = URL.createObjectURL(videoBlob);
        }

        if (eventBus && typeof eventBus.publish === 'function') {
          eventBus.publish('screamer:video-recorded', {
            blob: this.currentVideoBlob,
            url: this.currentVideoUrl,
            mimeType: this.recordedMimeType,
            durationMs,
            isFallback: false,
            timestamp: Date.now()
          });
        }

        this.notifyStopResolvers(this.currentVideoBlob);
      } catch (err) {
        console.warn('[ReactionRecorderService] Failed to construct Blob from recorded chunks:', err);
        this.engageFallback('Blob construction failed');
      }
    } else {
      this.engageFallback('Empty recorded chunks');
    }
  }

  /**
   * Engages fallback snapshot mechanism using captureService when video recording is unavailable.
   *
   * @param {string} [reason='unknown'] - Diagnostic reason for engaging fallback.
   */
  engageFallback(reason = 'unknown') {
    this.isRecording = false;
    this.isProcessing = false;
    let fallbackDataUrl = null;

    if (captureService && typeof captureService.captureReactionSnapshot === 'function') {
      const snap = captureService.captureReactionSnapshot();
      fallbackDataUrl = snap.dataUrl;
    }

    this.fallbackSnapshotUrl = fallbackDataUrl;

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('screamer:video-recorded', {
        blob: null,
        url: null,
        fallbackDataUrl,
        isFallback: true,
        reason,
        timestamp: Date.now()
      });
    }

    this.notifyStopResolvers(null);
  }

  /**
   * Notifies and clears all resolvers waiting for asynchronous stop recording completion.
   *
   * @param {Blob|null} blob - Finalised video Blob or null if fallback.
   */
  notifyStopResolvers(blob) {
    const resolvers = [...this.stopResolvers];
    this.stopResolvers = [];
    for (const resolver of resolvers) {
      try {
        resolver(blob);
      } catch {
        // Safe ignore
      }
    }
  }

  /**
   * Stops the active video recording synchronously triggering MediaRecorder stop.
   */
  stopRecording() {
    if (this.recordingTimeoutId !== null) {
      if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
        window.clearTimeout(this.recordingTimeoutId);
      } else if (typeof clearTimeout === 'function') {
        clearTimeout(this.recordingTimeoutId);
      }
      this.recordingTimeoutId = null;
    }

    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.isRecording = false;
        this.isProcessing = true;
        this.mediaRecorder.stop();
        return;
      } catch (error) {
        console.warn('[ReactionRecorderService] Exception while stopping MediaRecorder:', error);
      }
    }

    this.isRecording = false;
    this.isProcessing = false;
    this.notifyStopResolvers(this.currentVideoBlob);
  }

  /**
   * Stops the active video recording asynchronously, returning a Promise that resolves
   * only after the browser finishes emitting onstop and constructing the final Blob.
   *
   * @param {number} [timeoutMs=2000] - Safety guard timeout in milliseconds.
   * @returns {Promise<Blob|null>} Resolves with the video Blob or null on fallback.
   */
  stopRecordingAsync(timeoutMs = 2000) {
    return new Promise((resolve) => {
      // If already finished and not processing, resolve immediately
      if (!this.isRecording && !this.isProcessing) {
        resolve(this.currentVideoBlob);
        return;
      }

      let timeoutTimerId = null;
      const resolver = (blob) => {
        if (timeoutTimerId !== null) {
          if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
            window.clearTimeout(timeoutTimerId);
          } else if (typeof clearTimeout === 'function') {
            clearTimeout(timeoutTimerId);
          }
          timeoutTimerId = null;
        }
        resolve(blob);
      };

      this.stopResolvers.push(resolver);

      // Trigger MediaRecorder stop if active
      if (this.isRecording) {
        this.stopRecording();
      }

      // Safety fallback timer to prevent infinite waiting if browser stalls onstop
      const scheduleTimer = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
        ? window.setTimeout
        : (typeof setTimeout === 'function' ? setTimeout : null);

      if (scheduleTimer) {
        timeoutTimerId = scheduleTimer(() => {
          this.isProcessing = false;
          this.notifyStopResolvers(this.currentVideoBlob);
        }, timeoutMs);
      }
    });
  }

  /**
   * Initialises the EventBus listener to trigger recording upon visual screamer playback.
   */
  initialiseRecorderListener() {
    if (this.unsubscribeTrigger) {
      return;
    }

    if (eventBus && typeof eventBus.subscribe === 'function') {
      this.unsubscribeTrigger = eventBus.subscribe('screamer:playback-started', (data) => {
        const durationMs = (data && typeof data.durationMs === 'number')
          ? data.durationMs
          : DEFAULT_RECORDING_DURATION_MS;
        this.startRecording({ durationMs });
      });
    }
  }

  /**
   * Detaches the EventBus trigger listener.
   */
  detachRecorderListener() {
    if (typeof this.unsubscribeTrigger === 'function') {
      this.unsubscribeTrigger();
      this.unsubscribeTrigger = null;
    }
  }

  /**
   * Retrieves the current in-memory video Blob.
   *
   * @returns {Blob|null}
   */
  getVideoBlob() {
    return this.currentVideoBlob;
  }

  /**
   * Retrieves the preview Object URL for the video Blob.
   *
   * @returns {string|null}
   */
  getVideoUrl() {
    return this.currentVideoUrl;
  }

  /**
   * Checks whether a recorded video is ready in memory.
   *
   * @returns {boolean} True if video Blob exists.
   */
  hasRecording() {
    return this.currentVideoBlob !== null && this.currentVideoBlob.size > 0;
  }

  /**
   * Cleans up transient in-memory video references and revokes Object URL to prevent memory leaks.
   * Strictly enforces zero local persistence.
   */
  clearRecording() {
    this.stopRecording();

    if (this.currentVideoUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.currentVideoUrl);
    }

    this.currentVideoBlob = null;
    this.currentVideoUrl = null;
    this.recordedChunks = [];
    this.fallbackSnapshotUrl = null;
    this.isRecording = false;
    this.isProcessing = false;
    this.notifyStopResolvers(null);
  }
}

/**
 * Singleton instance of ReactionRecorderService.
 */
export const recorderService = new ReactionRecorderService();

export default recorderService;
