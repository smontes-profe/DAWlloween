/**
 * @file capture.js
 * @description Webcam frame capture service and in-memory reaction snapshot manager.
 * Captures instantaneous reaction frames from active webcam video streams onto an
 * off-screen HTML5 Canvas, encodes them to WebP (with JPEG fallback), and maintains
 * transient session state without local storage or file persistence.
 * Design Patterns: Singleton Pattern, Strategy / Fallback Encoding.
 * Language Standards: UK English (en-GB).
 */

import { cameraService } from './camera.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Generates an in-memory thematic Halloween silhouette SVG data URL
 * as a graceful fallback when webcam stream is unavailable or permission denied.
 *
 * @returns {string} Base64 SVG data URL.
 */
export function generateFallbackAvatar() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <rect width="100%" height="100%" fill="#0d0914"/>
    <circle cx="200" cy="200" r="160" fill="#1b1226" stroke="#ff7518" stroke-width="4"/>
    <!-- Jack-o'-lantern silhouette -->
    <ellipse cx="200" cy="215" rx="100" ry="85" fill="#ff7518"/>
    <ellipse cx="200" cy="215" rx="65" ry="85" fill="#ff8c3b"/>
    <ellipse cx="200" cy="215" rx="30" ry="85" fill="#ffa726"/>
    <!-- Stem -->
    <path d="M190 135 Q200 110 215 105 Q210 125 205 135 Z" fill="#388e3c"/>
    <!-- Eyes -->
    <polygon points="160,195 180,215 150,220" fill="#0d0914"/>
    <polygon points="240,195 250,220 220,215" fill="#0d0914"/>
    <!-- Nose -->
    <polygon points="200,225 190,240 210,240" fill="#0d0914"/>
    <!-- Sinister Grin -->
    <path d="M145 255 Q200 300 255 255 Q240 270 200 275 Q160 270 145 255 Z" fill="#0d0914"/>
  </svg>`;

  if (typeof btoa === 'function') {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Service managing reaction snapshots captured from webcam streams.
 */
export class ReactionCaptureService {
  /**
   * Initialises the reaction capture manager with empty in-memory state.
   */
  constructor() {
    /** @type {string|null} Base64 data URL string representing reaction image */
    this.currentSnapshot = null;
    /** @type {boolean} Indicates whether snapshot was from camera or fallback */
    this.isFallbackSnapshot = false;
    /** @type {number|null} Timestamp of capture */
    this.captureTimestamp = null;
    /** @type {string} Target image encoding format */
    this.preferredFormat = 'image/webp';
    /** @type {string} Fallback image encoding format */
    this.fallbackFormat = 'image/jpeg';
    /** @type {Function|null} Active EventBus subscription unbinder */
    this.unsubscribeTrigger = null;
  }

  /**
   * Captures an instantaneous reaction snapshot from a video element or active camera stream.
   * Encodes to WebP with automatic fallback to JPEG or thematic SVG placeholder.
   *
   * @param {Object} [options={}] - Capture configuration parameters.
   * @param {HTMLVideoElement|null} [options.videoElement=null] - Explicit video element to capture from.
   * @param {string} [options.format='image/webp'] - Target image MIME type.
   * @param {number} [options.quality=0.85] - Compression quality factor (0.0 to 1.0).
   * @returns {{ dataUrl: string, isFallback: boolean, width: number, height: number, timestamp: number }}
   */
  captureReactionSnapshot({
    videoElement = null,
    format = this.preferredFormat,
    quality = 0.85
  } = {}) {
    const video = videoElement || (cameraService ? cameraService.attachedVideoElement : null);
    const timestamp = Date.now();

    // If no active video element or video has zero dimensions, return thematic fallback
    if (!video || typeof video.videoWidth !== 'number' || video.videoWidth === 0) {
      const fallbackDataUrl = generateFallbackAvatar();
      this.currentSnapshot = fallbackDataUrl;
      this.isFallbackSnapshot = true;
      this.captureTimestamp = timestamp;

      return {
        dataUrl: fallbackDataUrl,
        isFallback: true,
        width: 400,
        height: 400,
        timestamp
      };
    }

    try {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        throw new Error('DOM Canvas API unavailable in non-browser environment.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to obtain 2D rendering context from offscreen canvas.');
      }

      // Draw current video frame onto the offscreen canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Attempt encoding to preferred format (WebP)
      let dataUrl = canvas.toDataURL(format, quality);

      // Verify that WebP was supported and produced valid output; if not, fallback to JPEG
      if (!dataUrl || !dataUrl.startsWith(`data:${format}`)) {
        dataUrl = canvas.toDataURL(this.fallbackFormat, quality);
      }

      this.currentSnapshot = dataUrl;
      this.isFallbackSnapshot = false;
      this.captureTimestamp = timestamp;

      return {
        dataUrl,
        isFallback: false,
        width: canvas.width,
        height: canvas.height,
        timestamp
      };
    } catch (error) {
      console.warn('[ReactionCaptureService] Frame grab failed, applying fallback avatar:', error);

      const fallbackDataUrl = generateFallbackAvatar();
      this.currentSnapshot = fallbackDataUrl;
      this.isFallbackSnapshot = true;
      this.captureTimestamp = timestamp;

      return {
        dataUrl: fallbackDataUrl,
        isFallback: true,
        width: 400,
        height: 400,
        timestamp
      };
    }
  }

  /**
   * Retrieves the current in-memory reaction snapshot data URL.
   *
   * @returns {string|null} Base64 data URL string or null if none captured.
   */
  getSnapshot() {
    return this.currentSnapshot;
  }

  /**
   * Explicitly sets the in-memory reaction snapshot.
   *
   * @param {string|null} dataUrl - Image data URL.
   * @param {boolean} [isFallback=false] - Whether this snapshot is a generated fallback avatar.
   */
  setSnapshot(dataUrl, isFallback = false) {
    this.currentSnapshot = dataUrl;
    this.isFallbackSnapshot = isFallback;
    this.captureTimestamp = dataUrl ? Date.now() : null;
  }

  /**
   * Checks whether a reaction snapshot is currently stored in memory.
   *
   * @returns {boolean} True if a snapshot exists.
   */
  hasSnapshot() {
    return typeof this.currentSnapshot === 'string' && this.currentSnapshot.length > 0;
  }

  /**
   * Checks whether the current snapshot was generated as a fallback avatar.
   *
   * @returns {boolean} True if fallback avatar.
   */
  isFallback() {
    return this.isFallbackSnapshot;
  }

  /**
   * Initialises the EventBus listener for game:trigger-screamer to synchronously
   * capture the reaction frame without frame lag and emit screamer:photo-captured.
   */
  initialiseCaptureListener() {
    if (this.unsubscribeTrigger) {
      return;
    }

    if (eventBus && typeof eventBus.subscribe === 'function') {
      this.unsubscribeTrigger = eventBus.subscribe('game:trigger-screamer', (eventData) => {
        const result = this.captureReactionSnapshot();

        if (eventBus && typeof eventBus.publish === 'function') {
          eventBus.publish('screamer:photo-captured', {
            dataUrl: result.dataUrl,
            isFallback: result.isFallback,
            width: result.width,
            height: result.height,
            timestamp: result.timestamp,
            triggerReason: eventData?.reason || 'climax'
          });
        }
      });
    }
  }

  /**
   * Detaches the EventBus trigger listener.
   */
  detachCaptureListener() {
    if (typeof this.unsubscribeTrigger === 'function') {
      this.unsubscribeTrigger();
      this.unsubscribeTrigger = null;
    }
  }

  /**
   * Clears the transient snapshot from memory, upholding zero local persistence principles.
   */
  clearSnapshot() {
    this.currentSnapshot = null;
    this.isFallbackSnapshot = false;
    this.captureTimestamp = null;
  }
}

/**
 * Global singleton instance of ReactionCaptureService.
 */
export const captureService = new ReactionCaptureService();
