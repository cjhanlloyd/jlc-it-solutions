// Front camera request and the guest-facing messages for each way it can fail.
export const CAMERA: MediaStreamConstraints = { video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1350 } }, audio: false };

// Why the camera can't even be asked for, or '' when it can.
export function cameraUnavailable(secure: boolean, hasApi: boolean): string {
  if (!secure) return 'The photo booth needs a secure (https) connection. Please open the invitation link again.';
  if (!hasApi) return 'This browser cannot use the camera. Please try another browser, like Chrome or Safari.';
  return '';
}

export function cameraError(e: unknown): string {
  switch ((e as { name?: string } | null)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in your browser settings to use the photo booth.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'We could not find a camera on this device.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Your camera is busy. Close other apps using it, then try again.';
    default:
      return 'The camera could not start. Please try again.';
  }
}
