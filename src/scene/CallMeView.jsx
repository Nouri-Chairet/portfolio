import { Suspense } from 'react';
import { View, PerspectiveCamera } from '@react-three/drei';
import CallMePose from './CallMePose';
import useInView from '../hooks/useInView';
import '../styles/journey.css';

/**
 * The journey panel's slice of the shared canvas.
 *
 * Renders the `.nouri` div that used to hold its own <Canvas>; drei's <View>
 * scissors the site-wide canvas to it, and the camera and lights below are the
 * ones that canvas used, so the pose renders identically.
 */
const CallMeView = () => {
  const [viewRef, inView] = useInView();

  return (
    <View className="nouri" ref={viewRef} index={2}>
      {/* Matches the old canvas's implicit default camera: fov 75, [0, 1, 5]. */}
      <PerspectiveCamera makeDefault position={[0, 1, 5]} fov={75} />
      <directionalLight position={[0, 7, 6]} intensity={2.3} castShadow />
      <ambientLight intensity={1} />
      {inView && (
        <Suspense fallback={null}>
          <CallMePose hitArea={viewRef} />
        </Suspense>
      )}
    </View>
  );
};

export default CallMeView;
