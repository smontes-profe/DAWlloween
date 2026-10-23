/**
 * @file camera.js
 * @description Webcam stream manager and reaction capture service.
 * Handles webcam handshake (getUserMedia), lifecycle events, offscreen snapshot capture,
 * and user-facing notifications for permissions or hardware errors.
 * Standards: UK English (en-GB), Zero local persistence.
 */

import { eventBus } from '../utils/eventBus.js';
import { alerts } from '../ui/alerts.js';

/**
 * Default media constraints prioritising front-facing high-definition feed.
 */
export const DEFAULT_CAMERA_CONSTRAINTS = {
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: false
};

/**
 * Camera Service managing webcam lifecycle and reaction snapshots.
 */
export class CameraService {
  /**
   * Initialise the camera service state.
   */
  constructor() {
    /** @type {MediaStream|null} */
    this.stream = null;
    /** @type {boolean} */
    this.isActive = false;
    /** @type {boolean} */
    this.hasPermission = false;
    /** @type {HTMLVideoElement|null} */
    this.attachedVideoElement = null;
  }

  /**
   * Check whether the browser environment supports media devices and getUserMedia.
   *
   * @returns {boolean} True if WebRTC media devices API is available.
   */
  isSupported() {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Request webcam permission and initialise the video MediaStream.
   * Dispatches events and accessible toast notifications upon success or denial.
   *
   * @param {MediaStreamConstraints} [constraints=DEFAULT_CAMERA_CONSTRAINTS] - Media constraints.
   * @returns {Promise<{ success: boolean, stream?: MediaStream, error?: Error|string }>}
   */
  async requestPermission(constraints = DEFAULT_CAMERA_CONSTRAINTS) {
    if (!this.isSupported()) {
      const errorMessage = 'Webcam access is not supported by your browser or insecure connection (HTTPS required).';
      if (alerts && typeof alerts.error === 'function') {
        alerts.error(errorMessage, 'Camera Unsupported');
      }
      if (eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish('camera:unsupported', { message: errorMessage });
      }
      return { success: false, error: 'NOT_SUPPORTED' };
    }

    try {
      // If a stream is already active, stop it before requesting anew
      if (this.stream) {
        this.stopStream();
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = mediaStream;
      this.isActive = true;
      this.hasPermission = true;

      if (eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish('camera:stream-ready', { stream: mediaStream });
      }

      return { success: true, stream: mediaStream };
    } catch (error) {
      this.hasPermission = false;
      this.isActive = false;
      this.stream = null;

      const isPermissionDenied =
        error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';

      if (isPermissionDenied) {
        const friendlyMessage =
          'Camera permission was denied. Please allow webcam access in your browser to participate in the experience.';
        if (alerts && typeof alerts.warning === 'function') {
          alerts.warning(friendlyMessage, 'Camera Access Denied');
        }
        if (eventBus && typeof eventBus.publish === 'function') {
          eventBus.publish('camera:permission-denied', { error });
        }
      } else {
        const failureMessage =
          error.name === 'NotFoundError'
            ? 'No webcam device was detected. Please connect a camera to proceed.'
            : `Unable to access webcam: ${error.message || error.name}`;

        if (alerts && typeof alerts.error === 'function') {
          alerts.error(failureMessage, 'Camera Error');
        }
        if (eventBus && typeof eventBus.publish === 'function') {
          eventBus.publish('camera:error', { error });
        }
      }

      return { success: false, error };
    }
  }

  /**
   * Attach the active MediaStream to an HTMLVideoElement and initiate playback.
   *
   * @param {HTMLVideoElement} videoElement - The target video element.
   * @returns {Promise<boolean>} True if stream was attached successfully; false otherwise.
   */
  async attachVideoElement(videoElement) {
    if (!videoElement || !this.stream) {
      return false;
    }

    try {
      this.attachedVideoElement = videoElement;
      videoElement.srcObject = this.stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.muted = true;

      await videoElement.play();
      return true;
    } catch (error) {
      console.error('[CameraService] Error playing video stream element:', error);
      return false;
    }
  }

  /**
   * Capture an instantaneous frame from the active video stream as a WebP data URL.
   * Zero local persistence is maintained; the frame is exported purely in memory.
   *
   * @param {string} [format='image/webp'] - Target image MIME format.
   * @param {number} [quality=0.85] - Compression quality between 0.0 and 1.0.
   * @returns {string|null} Base64 data URL string, or null if capture fails.
   */
  captureFrame(format = 'image/webp', quality = 0.85) {
    if (!this.stream || !this.isActive || typeof document === 'undefined') {
      return null;
    }

    const sourceElement = this.attachedVideoElement;
    if (!sourceElement || sourceElement.videoWidth === 0) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = sourceElement.videoWidth;
      canvas.height = sourceElement.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        return null;
      }

      // Render the current video frame onto the offscreen canvas
      context.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL(format, quality);

      if (eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish('camera:frame-captured', { format, quality });
      }

      return dataUrl;
    } catch (error) {
      console.error('[CameraService] Frame capture error:', error);
      return null;
    }
  }

  /**
   * Stop all active video tracks and tear down the MediaStream.
   */
  stopStream() {
    if (this.stream) {
      const tracks = this.stream.getTracks();
      for (const track of tracks) {
        if (typeof track.stop === 'function') {
          track.stop();
        }
      }
    }

    if (this.attachedVideoElement) {
      this.attachedVideoElement.srcObject = null;
      this.attachedVideoElement = null;
    }

    this.stream = null;
    this.isActive = false;

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('camera:stream-stopped');
    }
  }

  /**
   * Query whether the video stream is currently active.
   *
   * @returns {boolean} True if stream is live.
   */
  isStreamActive() {
    return this.isActive && !!this.stream;
  }

  /**
   * Query whether webcam permission was previously granted.
   *
   * @returns {boolean} True if permission was acquired.
   */
  hasUserPermission() {
    return this.hasPermission;
  }

  /**
   * Retrieve the raw MediaStream instance.
   *
   * @returns {MediaStream|null} The active stream or null.
   */
  getStream() {
    return this.stream;
  }
}

/**
 * Singleton instance of CameraService for shared application use.
 */
export const cameraService = new CameraService();

export default cameraService;
