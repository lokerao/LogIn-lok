import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { Button } from '@/components/ui/button';
import { colors, radius, spacing, typography } from '@/constants/design-system';

type Props = {
  visible: boolean;
  mode: 'check_in' | 'check_out';
  onClose: () => void;
  onProceed: (photoUri: string) => Promise<void>;
};

export function CameraCaptureModal({
  visible,
  mode,
  onClose,
  onProceed,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const titleText = mode === 'check_in' ? 'Check In Photo' : 'Check Out Photo';

  async function handleCapture() {
    if (!cameraRef.current || isCapturing || isProcessing) return;

    try {
      setIsCapturing(true);

      const rawPhoto = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!rawPhoto?.uri) {
        throw new Error('No image URI returned from camera.');
      }

      // Optimize image resolution and memory footprint (max width: 1080px, format: JPEG)
      // This reduces RAM usage drastically and prevents Android OOM/crashes on repeated captures
      const optimized = await manipulateAsync(
        rawPhoto.uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: SaveFormat.JPEG },
      );

      if (isMountedRef.current) {
        setCapturedUri(optimized.uri);
      }
    } catch (err) {
      console.error('[CameraCapture] Capture failure:', err);
      Alert.alert('Capture Failed', 'Could not take photo. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  }

  function handleRetake() {
    // Discard previous capture and instantly reveal the active camera without remounting hardware
    setCapturedUri(null);
  }

  async function handleProceed() {
    if (!capturedUri || isProcessing) return;

    setIsProcessing(true);
    try {
      await onProceed(capturedUri);
      if (isMountedRef.current) {
        setCapturedUri(null);
      }
      onClose();
    } catch (err) {
      console.error('[CameraCapture] onProceed error:', err);
      // Error alert handled by caller
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }

  function toggleFacing() {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }

  function handleCancel() {
    setCapturedUri(null);
    onClose();
  }

  return (
    <Modal animationType="slide" visible={visible}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{titleText}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPress={handleCancel}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionContainer}>
            <Text style={styles.permTitle}>Camera Permission Required</Text>
            <Text style={styles.permDesc}>
              LogIn requires live camera access to capture attendance photo verification. Gallery photos are strictly disabled for security.
            </Text>
            <Button accessibilityLabel="Grant Camera Permission" onPress={requestPermission}>
              Grant Camera Access
            </Button>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            {/* STABLE CAMERA VIEW (No children) */}
            <CameraView
              facing={facing}
              ref={cameraRef}
              style={styles.camera}
            />

            {/* CAMERA GUIDELINE OVERLAY (Rendered on top of camera as absolute sibling) */}
            <View pointerEvents="none" style={styles.cameraOverlay}>
              <View style={styles.guidelineBox}>
                <Text style={styles.guidelineText}>Align face within frame</Text>
              </View>
            </View>

            {/* Camera Controls */}
            <View style={styles.cameraControls}>
              <Pressable
                accessibilityLabel="Switch Camera"
                accessibilityRole="button"
                disabled={isCapturing}
                onPress={toggleFacing}
                style={styles.secondaryControl}
              >
                <Text style={styles.controlText}>Flip</Text>
              </Pressable>

              <Pressable
                accessibilityLabel="Capture Attendance Photo"
                accessibilityRole="button"
                disabled={isCapturing}
                onPress={() => void handleCapture()}
                style={styles.captureButton}
              >
                {isCapturing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Pressable>

              <View style={styles.secondaryControlSpacer} />
            </View>

            {/* PHOTO PREVIEW OVERLAY (Rendered seamlessly above camera when photo is captured) */}
            {Boolean(capturedUri) && (
              <View style={styles.previewOverlay}>
                <Text style={styles.previewHeading}>Photo Preview</Text>
                <Text style={styles.previewSubheading}>
                  Check that your face is clearly visible, well-lit, and centered before proceeding.
                </Text>

                <View style={styles.imageWrapper}>
                  <Image source={{ uri: capturedUri! }} style={styles.previewImage} />
                </View>

                <View style={styles.previewActions}>
                  <Pressable
                    accessibilityLabel="Retake photo"
                    accessibilityRole="button"
                    disabled={isProcessing}
                    onPress={handleRetake}
                    style={styles.retakeButton}
                  >
                    <Text style={styles.retakeText}>Retake</Text>
                  </Pressable>

                  <View style={styles.proceedWrapper}>
                    {isProcessing ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Button
                        accessibilityLabel="Proceed with photo"
                        onPress={() => void handleProceed()}
                      >
                        Proceed
                      </Button>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.ink,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  permissionContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    gap: spacing.md,
    margin: spacing.lg,
    padding: spacing.lg,
  },
  permTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  permDesc: {
    color: colors.muted,
    ...typography.body,
    lineHeight: 22,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    alignItems: 'center',
    bottom: 120,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  guidelineBox: {
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: radius.pill,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 280,
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
    width: 240,
  },
  guidelineText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraControls: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
  },
  secondaryControl: {
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  secondaryControlSpacer: {
    height: 48,
    width: 48,
  },
  controlText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  captureButton: {
    alignItems: 'center',
    borderColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 4,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  captureInner: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 60,
    width: 60,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.canvas,
    gap: spacing.sm,
    padding: spacing.lg,
    zIndex: 10,
  },
  previewHeading: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  previewSubheading: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  imageWrapper: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    flex: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  retakeButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#D5DDEA',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  retakeText: {
    color: colors.ink,
    ...typography.button,
  },
  proceedWrapper: {
    flex: 2,
  },
});
