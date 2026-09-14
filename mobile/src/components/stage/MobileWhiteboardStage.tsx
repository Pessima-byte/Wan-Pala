import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRoom } from '../../context/RoomContext';
import { WhiteboardStroke } from '../../types';
import {
  Palette,
  RotateCcw,
  Trash2,
  Brush,
  Eraser,
} from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');
const CANVAS_WIDTH = screenWidth - 24;
const CANVAS_HEIGHT = Math.round((CANVAS_WIDTH * 10) / 16);

const COLORS = [
  '#ffffff',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#38bdf8',
  '#818cf8',
  '#c084fc',
];

const STROKE_WIDTHS = [2, 4, 8, 16];

export const MobileWhiteboardStage: React.FC = () => {
  const { room, currentUser, sendWhiteboardStroke, undoWhiteboardStroke, clearWhiteboard } = useRoom();

  const [activeTool, setActiveTool] = useState<'brush' | 'eraser'>('brush');
  const [currentColor, setCurrentColor] = useState('#38bdf8');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);

  const isDrawingRef = useRef(false);
  const livePointsRef = useRef<{ x: number; y: number }[]>([]);

  // Convert points array to SVG path data (d="M x y L x y ...")
  const pointsToSvgPath = useCallback((points: { x: number; y: number }[], width: number, height: number) => {
    if (!points || points.length === 0) return '';
    const isNorm = points[0].x <= 1 && points[0].y <= 1;
    const getX = (p: { x: number; y: number }) => (isNorm ? p.x * width : p.x);
    const getY = (p: { x: number; y: number }) => (isNorm ? p.y * height : p.y);

    if (points.length === 1) {
      const x = getX(points[0]);
      const y = getY(points[0]);
      return `M ${x} ${y} L ${x + 0.1} ${y + 0.1}`;
    }

    let d = `M ${getX(points[0])} ${getY(points[0])}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${getX(points[i])} ${getY(points[i])}`;
    }
    return d;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        isDrawingRef.current = true;
        const { locationX, locationY } = evt.nativeEvent;
        const normX = Math.max(0, Math.min(1, locationX / CANVAS_WIDTH));
        const normY = Math.max(0, Math.min(1, locationY / CANVAS_HEIGHT));
        const initialPoint = { x: normX, y: normY };
        livePointsRef.current = [initialPoint];
        setCurrentPoints([initialPoint]);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (!isDrawingRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const normX = Math.max(0, Math.min(1, locationX / CANVAS_WIDTH));
        const normY = Math.max(0, Math.min(1, locationY / CANVAS_HEIGHT));
        const newPoint = { x: normX, y: normY };
        livePointsRef.current.push(newPoint);
        setCurrentPoints([...livePointsRef.current]);
      },
      onPanResponderRelease: () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        const points = livePointsRef.current;
        if (points.length > 0) {
          const newStroke: WhiteboardStroke = {
            id: 'stroke-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            color: activeTool === 'eraser' ? '#0f172a' : currentColor,
            width: activeTool === 'eraser' ? currentWidth * 3 : currentWidth,
            points,
            userId: currentUser.id,
          };
          sendWhiteboardStroke(newStroke);
        }
        livePointsRef.current = [];
        setCurrentPoints([]);
      },
      onPanResponderTerminate: () => {
        isDrawingRef.current = false;
        livePointsRef.current = [];
        setCurrentPoints([]);
      },
    })
  ).current;

  const strokes = room?.whiteboardStrokes || [];

  return (
    <View style={styles.container}>
      {/* Whiteboard Canvas Area */}
      <View
        style={[styles.canvasBox, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }]}
        {...panResponder.panHandlers}
      >
        <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={StyleSheet.absoluteFill}>
          {/* Committed strokes from room */}
          {strokes.map((stroke, index) => {
            const pathData = pointsToSvgPath(stroke.points, CANVAS_WIDTH, CANVAS_HEIGHT);
            if (!pathData) return null;
            return (
              <Path
                key={stroke.id || `stroke-${index}`}
                d={pathData}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}

          {/* Active live drawing stroke */}
          {currentPoints.length > 0 && (
            <Path
              d={pointsToSvgPath(currentPoints, CANVAS_WIDTH, CANVAS_HEIGHT)}
              stroke={activeTool === 'eraser' ? '#0f172a' : currentColor}
              strokeWidth={activeTool === 'eraser' ? currentWidth * 3 : currentWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>

        {strokes.length === 0 && currentPoints.length === 0 && (
          <View style={styles.emptyPrompt} pointerEvents="none">
            <Palette size={28} color="rgba(255, 255, 255, 0.25)" />
            <Text style={styles.emptyPromptText}>Draw with your finger to collaborate</Text>
          </View>
        )}
      </View>

      {/* Toolbar Controls */}
      <View style={styles.toolbar}>
        {/* Left: Tool Selection & Action buttons */}
        <View style={styles.toolsRow}>
          {/* Brush button */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'brush' && styles.toolBtnActive]}
            onPress={() => setActiveTool('brush')}
            activeOpacity={0.8}
          >
            <Brush size={16} color={activeTool === 'brush' ? '#38bdf8' : '#94a3b8'} />
          </TouchableOpacity>

          {/* Eraser button */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'eraser' && styles.toolBtnActive]}
            onPress={() => setActiveTool('eraser')}
            activeOpacity={0.8}
          >
            <Eraser size={16} color={activeTool === 'eraser' ? '#f472b6' : '#94a3b8'} />
          </TouchableOpacity>

          {/* Stroke Width Selector */}
          <View style={styles.widthGroup}>
            {STROKE_WIDTHS.map(w => (
              <TouchableOpacity
                key={w}
                style={[styles.widthBtn, currentWidth === w && styles.widthBtnActive]}
                onPress={() => setCurrentWidth(w)}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    width: w * 2.2,
                    height: w * 2.2,
                    borderRadius: (w * 2.2) / 2,
                    backgroundColor: currentWidth === w ? '#38bdf8' : '#64748b',
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Undo */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={undoWhiteboardStroke}
            activeOpacity={0.8}
          >
            <RotateCcw size={15} color="#cbd5e1" />
          </TouchableOpacity>

          {/* Clear */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.clearBtn]}
            onPress={clearWhiteboard}
            activeOpacity={0.8}
          >
            <Trash2 size={15} color="#f87171" />
          </TouchableOpacity>
        </View>

        {/* Color Palette Row */}
        {activeTool === 'brush' && (
          <View style={styles.colorsRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorCircle,
                  { backgroundColor: c },
                  currentColor === c && styles.colorCircleActive,
                ]}
                onPress={() => setCurrentColor(c)}
                activeOpacity={0.8}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0a0d14',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  canvasBox: {
    backgroundColor: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyPrompt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyPromptText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    fontWeight: '500',
  },
  toolbar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111622',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  widthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 8,
  },
  widthBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  widthBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  colorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.2 }],
  },
});
