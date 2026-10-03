// Icons, drawn as SVG on a 24x24 grid. Hand-rolled: the app needs about thirty
// glyphs and an icon font would add a font-loading step to every cold start.

import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'history' | 'dumbbell' | 'list' | 'chart' | 'settings' | 'plus' | 'minus'
  | 'check' | 'close' | 'back' | 'chevron' | 'down' | 'more' | 'search' | 'trash' | 'edit'
  | 'copy' | 'play' | 'timer' | 'trophy' | 'flame' | 'link' | 'swap' | 'calc' | 'info'
  | 'note' | 'upload' | 'download' | 'calendar' | 'scale' | 'up' | 'bolt' | 'target'
  | 'stop' | 'drag' | 'body';

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <Path d="M4 11 12 4l8 7" />
      <Path d="M6 9.5V20h12V9.5" />
    </>
  ),
  history: (
    <>
      <Path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <Path d="M4 4v4h4" />
      <Path d="M12 8v4.5l3 1.8" />
    </>
  ),
  dumbbell: (
    <>
      <Rect x={2.5} y={9} width={3} height={6} rx={1} />
      <Rect x={5.5} y={6.5} width={3} height={11} rx={1} />
      <Rect x={15.5} y={6.5} width={3} height={11} rx={1} />
      <Rect x={18.5} y={9} width={3} height={6} rx={1} />
      <Line x1={8.5} y1={12} x2={15.5} y2={12} />
    </>
  ),
  list: (
    <>
      <Line x1={8} y1={6} x2={20} y2={6} />
      <Line x1={8} y1={12} x2={20} y2={12} />
      <Line x1={8} y1={18} x2={20} y2={18} />
      <Circle cx={4} cy={6} r={0.6} />
      <Circle cx={4} cy={12} r={0.6} />
      <Circle cx={4} cy={18} r={0.6} />
    </>
  ),
  chart: (
    <>
      <Path d="M4 4v16h16" />
      <Path d="M7.5 15l4-4.5 3 2.5L20 6.5" />
    </>
  ),
  settings: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  plus: (
    <>
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </>
  ),
  minus: <Line x1={5} y1={12} x2={19} y2={12} />,
  check: <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  close: (
    <>
      <Line x1={6} y1={6} x2={18} y2={18} />
      <Line x1={18} y1={6} x2={6} y2={18} />
    </>
  ),
  back: <Path d="M15 4 7 12l8 8" />,
  chevron: <Path d="M9 5l7 7-7 7" />,
  down: <Path d="M5 9l7 7 7-7" />,
  up: <Path d="M5 15l7-7 7 7" />,
  more: (
    <>
      <Circle cx={5} cy={12} r={1.4} />
      <Circle cx={12} cy={12} r={1.4} />
      <Circle cx={19} cy={12} r={1.4} />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Line x1={16} y1={16} x2={20.5} y2={20.5} />
    </>
  ),
  trash: (
    <>
      <Path d="M4 7h16" />
      <Path d="M9 7V4h6v3" />
      <Path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
    </>
  ),
  edit: <Path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
  copy: (
    <>
      <Rect x={8} y={8} width={12} height={12} rx={2} />
      <Path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  play: <Path d="M7 4.5v15l12.5-7.5L7 4.5Z" />,
  stop: <Rect x={6} y={6} width={12} height={12} rx={2} />,
  timer: (
    <>
      <Circle cx={12} cy={13.5} r={7.5} />
      <Path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6" />
    </>
  ),
  trophy: (
    <>
      <Path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
      <Path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z" />
    </>
  ),
  flame: <Path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.3-5 .3 1.6 1 2.6 2 3C10.6 9 11 5.6 12 3Z" />,
  link: (
    <>
      <Path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.4 6.4" />
      <Path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.4-1.4" />
    </>
  ),
  swap: <Path d="M7 4 4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7" />,
  calc: (
    <>
      <Rect x={5} y={3} width={14} height={18} rx={2} />
      <Rect x={8} y={6} width={8} height={3.5} rx={0.6} />
      <Path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Line x1={12} y1={11} x2={12} y2={16.5} />
      <Line x1={12} y1={7.8} x2={12.01} y2={7.8} />
    </>
  ),
  note: (
    <>
      <Path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <Path d="M14 3v5h5M8.5 13h7M8.5 17h5" />
    </>
  ),
  upload: (
    <>
      <Path d="M12 15V4" />
      <Path d="M8 7.5 12 3.5l4 4" />
      <Path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </>
  ),
  download: (
    <>
      <Path d="M12 4v11" />
      <Path d="M8 11l4 4 4-4" />
      <Path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </>
  ),
  calendar: (
    <>
      <Rect x={4} y={5} width={16} height={15} rx={2} />
      <Path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </>
  ),
  scale: (
    <>
      <Rect x={3.5} y={4} width={17} height={16} rx={3} />
      <Path d="M8 9.5a5.5 5.5 0 0 1 8 0L12.8 12" />
    </>
  ),
  bolt: <Path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />,
  target: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Circle cx={12} cy={12} r={4.5} />
      <Circle cx={12} cy={12} r={0.8} />
    </>
  ),
  drag: (
    <>
      <Line x1={5} y1={9} x2={19} y2={9} />
      <Line x1={5} y1={15} x2={19} y2={15} />
    </>
  ),
  body: (
    <>
      <Circle cx={12} cy={4.5} r={2} />
      <Path d="M5 8.5h14M12 8.5V14M12 14l-3 7M12 14l3 7" />
    </>
  ),
};

const FILLED = new Set<IconName>(['play', 'bolt', 'flame', 'stop']);

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 1.9,
  filled,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  const solid = filled ?? FILLED.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? color : 'none'}
      stroke={color}
      strokeWidth={solid ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </Svg>
  );
}
