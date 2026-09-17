import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Ícones de traço do protótipo (24x24, stroke 2.75, pontas arredondadas). */
export type IconName =
  | 'sliders'
  | 'file'
  | 'plus'
  | 'download'
  | 'search'
  | 'lock'
  | 'bookmark'
  | 'more'
  | 'back'
  | 'close'
  | 'list'
  | 'grid'
  | 'hash'
  | 'scroll'
  | 'fit'
  | 'moon'
  | 'print'
  | 'share'
  | 'rename'
  | 'trash'
  | 'chevronLeft'
  | 'chevronRight'
  | 'alert';

type Props = {
  name: IconName;
  size?: number;
  color: string;
  /** Preenche o ícone (marcador ativo). */
  filled?: boolean;
};

const PATHS: Record<IconName, string> = {
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  search: 'M21 21l-4.3-4.3',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z',
  more: '',
  back: 'M19 12H5M12 19l-7-7 7-7',
  close: 'M18 6 6 18M6 6l12 12',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  grid: '',
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  scroll: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
  fit: 'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  print: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  rename: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  alert: 'M12 3l9.5 17H2.5L12 3zM12 9v4M12 17h.01',
};

export default function Icon({ name, size = 22, color, filled }: Props) {
  const stroke = { stroke: color, strokeWidth: 2.75, strokeLinecap: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'more' ? (
        <>
          <Circle cx="12" cy="5" r="1.8" fill={color} />
          <Circle cx="12" cy="12" r="1.8" fill={color} />
          <Circle cx="12" cy="19" r="1.8" fill={color} />
        </>
      ) : name === 'grid' ? (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="2" {...stroke} />
          <Rect x="14" y="3" width="7" height="7" rx="2" {...stroke} />
          <Rect x="3" y="14" width="7" height="7" rx="2" {...stroke} />
          <Rect x="14" y="14" width="7" height="7" rx="2" {...stroke} />
        </>
      ) : (
        <>
          {name === 'search' && <Circle cx="11" cy="11" r="8" {...stroke} />}
          {name === 'lock' && <Rect x="3" y="11" width="18" height="11" rx="3" {...stroke} />}
          {name === 'print' && <Rect x="6" y="14" width="12" height="8" rx="2" {...stroke} />}
          <Path d={PATHS[name]} {...stroke} strokeLinejoin="round" fill={filled ? color : 'none'} />
        </>
      )}
    </Svg>
  );
}
