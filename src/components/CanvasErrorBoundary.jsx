import React from 'react';

// Catches errors thrown while creating/rendering a WebGL Canvas
// (e.g. "Error creating WebGL context." when the GPU/WebGL is disabled or
// the context limit is hit) so a failing 3D view degrades gracefully
// instead of white-screening the whole app.
class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('3D canvas disabled (WebGL unavailable):', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default CanvasErrorBoundary;
