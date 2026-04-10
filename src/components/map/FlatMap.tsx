'use client';

import { useMemo, useState } from 'react';
import { isLand } from '@/lib/world-data';

// ─── Types ───

export interface FlatMapTrajectoryPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface FlatMapTrajectory {
  id: string;
  name: string;
  color: string;
  locations: FlatMapTrajectoryPoint[];
}

interface FlatMapProps {
  trajectories?: FlatMapTrajectory[];
  onTrajectoryClick?: (trajectory: FlatMapTrajectory) => void;
  focusTrajectoryId?: string | null;
  className?: string;
  isDark?: boolean;
}

// ─── Enhanced continent polygon data ───
// [lat, lng] pairs — used to generate SVG paths and for land detection.
// Equirectangular projection: x = 180 + lng, y = 90 - lat

interface LandPolygon {
  name: string;
  vertices: [number, number][];
}

const LAND_POLYGONS: LandPolygon[] = [
  // ── North America (mainland, enhanced) ──
  {
    name: 'North America',
    vertices: [
      [70, -168], [72, -155], [71, -143], [70, -138], [65, -139],
      [62, -150], [60, -147], [60, -141], [58, -136], [57, -134],
      [56, -133], [55, -132], [52, -128], [49, -126], [48, -125],
      [46, -124], [44, -124], [42, -124], [40, -124], [38, -123],
      [37, -122], [35, -121], [34, -120], [33, -118], [32, -117],
      [31, -117], [30, -114], [29, -113], [28, -112], [26, -110],
      [24, -110], [23, -106], [22, -106], [20, -105], [19, -104],
      [18, -103], [16, -100], [15, -97], [16, -93], [17, -89],
      [18, -88], [19, -87], [21, -87], [21, -84], [22, -82],
      [20, -77], [18, -76], [15, -84], [14, -87], [10, -84],
      [9, -80], [9, -77], [8, -77],
      // Caribbean coast going east then north
      [10, -75], [11, -73], [12, -72],
      // North along Atlantic coast
      [18, -68], [20, -66], [22, -63], [22, -60],
      // Yucatan and Gulf coast
      [21, -87], [19, -91], [20, -97], [22, -98], [25, -97],
      [27, -97], [28, -96], [29, -95], [30, -90], [30, -88],
      [29, -85], [28, -83], [26, -82], [25, -81], [25, -80],
      [27, -80], [28, -80], [30, -81], [32, -80], [33, -79],
      [35, -75], [37, -76], [38, -75], [40, -74], [41, -72],
      [42, -70], [43, -70], [44, -67], [45, -64], [47, -60],
      [47, -55], [49, -56], [50, -56], [51, -58], [52, -56],
      [52, -60], [53, -60], [55, -59], [55, -64], [57, -66],
      [58, -66], [60, -64], [60, -62], [59, -63],
      // Hudson Bay region (west coast)
      [60, -70], [61, -72], [62, -76], [63, -79], [62, -82],
      [60, -85], [58, -88], [57, -93], [58, -95], [60, -93],
      [61, -91], [62, -90], [63, -82], [64, -78], [63, -79],
      // Eastern Hudson Bay / Labrador
      [55, -80], [53, -80], [52, -82], [54, -84], [55, -82],
      [56, -79], [57, -76], [58, -73], [60, -68], [60, -65],
      // Newfoundland area
      [47, -53], [47, -56], [46, -57], [45, -61], [44, -63],
      [43, -66], [42, -70],
      // Far north
      [60, -64], [62, -62], [63, -60], [65, -62], [67, -62],
      [68, -65], [70, -62], [70, -65], [70, -68], [72, -75],
      [72, -80], [72, -95], [73, -100], [72, -115], [72, -125],
      [72, -140], [70, -158], [70, -168],
    ],
  },
  // ── Greenland ──
  {
    name: 'Greenland',
    vertices: [
      [60, -45], [62, -50], [65, -54], [66, -54], [68, -55],
      [70, -55], [72, -52], [75, -42], [76, -35], [77, -28],
      [76, -20], [76, -18], [74, -18], [72, -22], [70, -22],
      [68, -25], [66, -30], [65, -38], [64, -42], [62, -45],
      [60, -45],
    ],
  },
  // ── Cuba ──
  {
    name: 'Cuba',
    vertices: [
      [22, -84], [22, -80], [21, -77], [20, -75], [20, -74],
      [21, -77], [22, -80], [22, -84],
    ],
  },
  // ── South America (enhanced) ──
  {
    name: 'South America',
    vertices: [
      [12, -72], [11, -73], [10, -75], [8, -77], [7, -77],
      [5, -77], [2, -79], [0, -80], [-3, -80], [-5, -81],
      [-8, -79], [-12, -77], [-15, -75], [-18, -71], [-18, -70],
      [-20, -70], [-22, -70], [-24, -70], [-26, -70], [-28, -69],
      [-30, -70], [-33, -72], [-36, -73], [-39, -73], [-42, -73],
      [-45, -74], [-48, -75], [-50, -75], [-52, -74], [-54, -72],
      [-55, -70], [-55, -67], [-54, -65], [-53, -66], [-52, -68],
      [-50, -70], [-47, -66], [-45, -65], [-43, -65], [-42, -64],
      [-40, -63], [-38, -62], [-36, -60], [-35, -57], [-34, -54],
      [-34, -52], [-33, -52], [-30, -50], [-28, -49], [-25, -47],
      [-24, -45], [-23, -43], [-23, -41], [-18, -40], [-15, -39],
      [-12, -38], [-10, -37], [-6, -35], [-2, -35], [0, -50],
      [2, -52], [4, -55], [5, -58], [7, -60], [8, -62],
      [9, -65], [10, -67], [11, -69], [12, -72],
    ],
  },
  // ── Europe (enhanced) ──
  {
    name: 'Europe',
    vertices: [
      // Iberian Peninsula
      [36, -9], [37, -8], [38, -9], [40, -9], [43, -9],
      [44, -1], [46, -1], [48, -5], [47, -2], [47, 0],
      [49, 1], [50, 1], [51, 2], [53, 5], [54, 8],
      [54, 10], [55, 12], [56, 10], [57, 10], [58, 12],
      [60, 10], [60, 12], [61, 12], [62, 14],
      // Scandinavia west coast
      [63, 10], [64, 9], [65, 12], [66, 14], [68, 15],
      [69, 16], [70, 18], [70, 20], [71, 26], [70, 28],
      // Northern Finland / Russia border
      [68, 28], [67, 30], [65, 30], [63, 30], [61, 30],
      [60, 30], [59, 28], [57, 28], [56, 24], [55, 22],
      [54, 20], [54, 14], [52, 14], [51, 16], [50, 18],
      [48, 17], [47, 16], [46, 14], [45, 14], [44, 12],
      [42, 12], [42, 14], [41, 16], [40, 18], [39, 18],
      [38, 16], [38, 14], [37, 12], [36, 10], [37, 6],
      [37, 3], [37, 0], [37, -2], [36, -6], [36, -9],
    ],
  },
  // ── Scandinavia Peninsula (for better detail) ──
  {
    name: 'Scandinavia',
    vertices: [
      [56, 8], [58, 8], [58, 11], [60, 5], [62, 5],
      [63, 8], [65, 12], [66, 14], [68, 16], [70, 20],
      [71, 26], [70, 28], [68, 28], [66, 26], [64, 24],
      [62, 22], [60, 20], [59, 18], [58, 16], [57, 14],
      [56, 12], [56, 8],
    ],
  },
  // ── British Isles ──
  {
    name: 'British Isles',
    vertices: [
      [50, -6], [50, -5], [51, -5], [52, -5], [53, -3],
      [54, -3], [54, -2], [55, -2], [56, -3], [57, -4],
      [58, -5], [58, -3], [57, -2], [56, -1], [55, 0],
      [54, 0], [53, 0], [52, 1], [51, 1], [50, 1],
      [50, -1], [50, -5], [50, -6],
    ],
  },
  // ── Ireland ──
  {
    name: 'Ireland',
    vertices: [
      [52, -10], [53, -10], [54, -10], [55, -8], [55, -6],
      [54, -6], [53, -6], [52, -7], [51, -10], [52, -10],
    ],
  },
  // ── Iceland ──
  {
    name: 'Iceland',
    vertices: [
      [63, -24], [64, -22], [65, -19], [66, -16], [66, -14],
      [65, -13], [64, -14], [63, -18], [63, -22], [63, -24],
    ],
  },
  // ── Africa (enhanced) ──
  {
    name: 'Africa',
    vertices: [
      [37, -10], [37, -5], [37, 0], [37, 10], [36, 11],
      [35, 12], [33, 12], [32, 13], [31, 16], [32, 25],
      [30, 32], [28, 34], [22, 36], [20, 38], [18, 40],
      [15, 42], [12, 44], [11, 50], [8, 50], [5, 45],
      [2, 42], [0, 42], [-3, 41], [-5, 40], [-8, 40],
      [-10, 40], [-12, 40], [-15, 39], [-18, 37], [-20, 35],
      [-22, 35], [-25, 35], [-28, 33], [-30, 31], [-33, 27],
      [-34, 25], [-35, 20], [-34, 18], [-33, 18], [-30, 17],
      [-28, 16], [-25, 14], [-22, 14], [-18, 12], [-15, 12],
      [-12, 10], [-8, 8], [-5, 8], [-3, 10], [0, 10],
      [3, 10], [5, 5], [5, 2], [5, 0], [5, -3],
      [4, -6], [5, -8], [8, -13], [10, -15], [12, -17],
      [15, -17], [17, -16], [20, -17], [22, -17], [25, -16],
      [26, -15], [28, -13], [30, -10], [32, -8], [34, -5],
      [35, -3], [36, -5], [37, -10],
    ],
  },
  // ── Madagascar ──
  {
    name: 'Madagascar',
    vertices: [
      [-12, 49], [-13, 50], [-16, 50], [-18, 48], [-20, 44],
      [-23, 44], [-25, 44], [-25, 46], [-23, 47], [-20, 48],
      [-16, 50], [-14, 50], [-12, 49],
    ],
  },
  // ── Asia (mainland, enhanced) ──
  {
    name: 'Asia Mainland',
    vertices: [
      // Turkey / Middle East coast
      [42, 30], [40, 28], [37, 36], [36, 36], [35, 36],
      [33, 36], [30, 35], [28, 34], [27, 36], [25, 37],
      [22, 39], [20, 40], [18, 40], [16, 43], [15, 44],
      [13, 45], [12, 45], [14, 48], [16, 52], [18, 53],
      [20, 57], [22, 59], [25, 60], [25, 62], [25, 66],
      [26, 68], [24, 68], [22, 69], [20, 73], [16, 74],
      [10, 78], [8, 77], [7, 80], [8, 80], [10, 80],
      [10, 78], [15, 75], [20, 73], [22, 70], [25, 68],
      [28, 66], [28, 62], [30, 58], [32, 52], [34, 48],
      [35, 45], [37, 42], [38, 40], [37, 38], [36, 36],
      [35, 33], [33, 32], [30, 32], [28, 34],
      // Arabian Peninsula
      [28, 34], [26, 36], [22, 39], [20, 41], [18, 43],
      [15, 45], [13, 45], [12, 44], [14, 42], [16, 43],
      [18, 42], [20, 40], [22, 38], [25, 37],
      // India
      [22, 69], [20, 73], [16, 74], [12, 75], [10, 76],
      [8, 77], [7, 80], [6, 80], [8, 82], [10, 80],
      [12, 80], [15, 80], [18, 83], [20, 87], [22, 88],
      [22, 89], [24, 89], [26, 90], [28, 88], [28, 84],
      [30, 81], [30, 78], [28, 76], [26, 72], [24, 70],
      [22, 69],
      // South / Southeast Asia
      [22, 89], [20, 92], [18, 96], [16, 98], [14, 99],
      [10, 99], [8, 100], [5, 100], [2, 100], [1, 104],
      [2, 106], [4, 108], [6, 106], [8, 105], [10, 106],
      [12, 108], [14, 109], [16, 108], [18, 107], [20, 107],
      [22, 106], [22, 103], [20, 100], [22, 97],
      // China coast / Korea
      [22, 108], [24, 110], [25, 119], [26, 120], [28, 121],
      [30, 122], [32, 122], [34, 121], [36, 121], [38, 121],
      [39, 120], [40, 120], [40, 118], [38, 117], [36, 120],
      [35, 126], [36, 128], [38, 129], [40, 128], [42, 130],
      [44, 132], [46, 134], [48, 135], [50, 137], [52, 140],
      [54, 143], [56, 143], [58, 142], [60, 143], [62, 145],
      [60, 150], [58, 155], [55, 158], [52, 156], [50, 155],
      [48, 152], [46, 150], [44, 148], [42, 146], [40, 142],
      [38, 140], [36, 138], [35, 135], [34, 132], [33, 130],
      [32, 128], [30, 122],
      // Siberia / Far East Russia
      [62, 145], [63, 152], [65, 160], [65, 168], [64, 175],
      [62, 178], [60, 170], [58, 162], [55, 158], [52, 156],
      [50, 155], [48, 153], [46, 152],
      // Northern Asia / Siberia
      [70, 42], [72, 50], [72, 60], [73, 70], [74, 80],
      [73, 90], [72, 100], [72, 110], [72, 120], [72, 130],
      [72, 140], [70, 145], [68, 150], [66, 160], [66, 168],
      [65, 175], [63, 178], [60, 170],
      // Arctic coast / Ural region
      [60, 170], [58, 162], [55, 158],
      [52, 156], [50, 155], [48, 153], [46, 150],
      [44, 148], [42, 146], [40, 142],
      // Western Asia / Urals to Turkey
      [70, 40], [68, 38], [65, 40], [62, 40], [60, 38],
      [58, 36], [56, 34], [54, 32], [52, 30], [50, 30],
      [48, 30], [46, 30], [44, 30], [42, 30],
    ],
  },
  // ── Arabian Peninsula (separate for clarity) ──
  {
    name: 'Arabia',
    vertices: [
      [30, 35], [28, 36], [26, 38], [24, 39], [22, 40],
      [20, 41], [18, 43], [16, 43], [15, 44], [13, 45],
      [12, 45], [14, 48], [16, 52], [18, 56], [20, 57],
      [22, 59], [24, 58], [26, 56], [27, 52], [28, 50],
      [29, 48], [30, 48], [30, 44], [30, 35],
    ],
  },
  // ── India (subcontinent) ──
  {
    name: 'India',
    vertices: [
      [30, 70], [28, 68], [26, 68], [24, 70], [22, 70],
      [20, 73], [18, 74], [16, 74], [14, 75], [12, 76],
      [10, 78], [8, 78], [8, 80], [10, 80], [12, 80],
      [14, 80], [16, 82], [18, 83], [20, 86], [22, 88],
      [24, 89], [26, 90], [28, 88], [30, 82], [32, 78],
      [32, 76], [30, 72], [30, 70],
    ],
  },
  // ── China / East Asia ──
  {
    name: 'China',
    vertices: [
      [42, 80], [40, 76], [38, 75], [36, 76], [34, 78],
      [30, 82], [28, 88], [26, 98], [22, 100], [22, 106],
      [20, 108], [22, 110], [24, 114], [26, 119], [28, 121],
      [30, 122], [32, 122], [34, 121], [36, 120], [38, 120],
      [40, 118], [42, 120], [44, 125], [46, 130], [48, 135],
      [50, 130], [50, 120], [48, 110], [46, 100], [44, 88],
      [42, 80],
    ],
  },
  // ── Japan ──
  {
    name: 'Japan',
    vertices: [
      [31, 131], [32, 132], [33, 133], [34, 134], [35, 136],
      [36, 137], [37, 137], [38, 139], [39, 140], [40, 140],
      [41, 140], [42, 141], [43, 145], [44, 145], [43, 143],
      [42, 141], [40, 140], [39, 138], [37, 136], [36, 134],
      [35, 132], [34, 131], [33, 130], [32, 131], [31, 131],
    ],
  },
  // ── Korean Peninsula ──
  {
    name: 'Korea',
    vertices: [
      [34, 126], [35, 126], [36, 126], [37, 127], [38, 128],
      [39, 128], [40, 128], [40, 126], [38, 125], [37, 126],
      [36, 126], [35, 126], [34, 126],
    ],
  },
  // ── Southeast Asia mainland ──
  {
    name: 'SE Asia Mainland',
    vertices: [
      [22, 97], [20, 100], [18, 103], [16, 104], [14, 105],
      [12, 108], [10, 106], [8, 105], [6, 104], [4, 103],
      [2, 104], [1, 103], [2, 100], [4, 100], [6, 100],
      [8, 100], [10, 99], [14, 99], [18, 97], [20, 97],
      [22, 97],
    ],
  },
  // ── Indonesia (Sumatra, Java, Borneo simplified) ──
  {
    name: 'Indonesia',
    vertices: [
      [5, 95], [2, 96], [0, 98], [-2, 100], [-4, 104],
      [-6, 106], [-8, 110], [-8, 114], [-7, 118], [-8, 122],
      [-6, 125], [-8, 128], [-5, 132], [-8, 136], [-6, 140],
      [-8, 140], [-10, 138], [-10, 130], [-10, 122],
      [-8, 115], [-8, 108], [-6, 102], [-4, 98], [-2, 96],
      [0, 98], [2, 96], [4, 96], [5, 95],
    ],
  },
  // ── Philippines ──
  {
    name: 'Philippines',
    vertices: [
      [18, 120], [16, 121], [14, 121], [12, 124], [10, 125],
      [8, 126], [7, 125], [8, 123], [10, 122], [12, 120],
      [14, 120], [16, 119], [18, 120],
    ],
  },
  // ── Taiwan ──
  {
    name: 'Taiwan',
    vertices: [
      [25, 121], [24, 121], [22, 120], [22, 121], [23, 122],
      [25, 122], [25, 121],
    ],
  },
  // ── Sri Lanka ──
  {
    name: 'Sri Lanka',
    vertices: [
      [10, 80], [8, 80], [6, 80], [6, 82], [8, 82], [10, 80],
    ],
  },
  // ── Australia (enhanced) ──
  {
    name: 'Australia',
    vertices: [
      [-12, 130], [-14, 127], [-15, 124], [-16, 122], [-18, 122],
      [-20, 118], [-22, 114], [-24, 113], [-26, 113], [-28, 114],
      [-30, 115], [-32, 116], [-34, 117], [-35, 118], [-35, 120],
      [-34, 125], [-35, 130], [-36, 135], [-37, 140], [-38, 145],
      [-38, 148], [-37, 150], [-35, 152], [-33, 152], [-30, 153],
      [-28, 153], [-25, 152], [-22, 150], [-20, 149], [-18, 147],
      [-16, 146], [-15, 145], [-14, 144], [-13, 142], [-12, 136],
      [-11, 134], [-12, 132], [-12, 130],
    ],
  },
  // ── Tasmania ──
  {
    name: 'Tasmania',
    vertices: [
      [-41, 145], [-42, 145], [-43, 146], [-44, 148], [-43, 148],
      [-42, 147], [-41, 146], [-41, 145],
    ],
  },
  // ── New Zealand ──
  {
    name: 'New Zealand',
    vertices: [
      [-35, 173], [-37, 174], [-38, 175], [-39, 176], [-41, 175],
      [-42, 174], [-44, 172], [-46, 167], [-45, 166], [-43, 170],
      [-42, 172], [-40, 175], [-38, 178], [-37, 177], [-36, 175],
      [-35, 174], [-35, 173],
    ],
  },
  // ── Papua New Guinea ──
  {
    name: 'Papua New Guinea',
    vertices: [
      [-2, 141], [-4, 142], [-6, 143], [-8, 144], [-10, 146],
      [-10, 148], [-8, 150], [-6, 150], [-4, 148], [-2, 146],
      [-1, 144], [-1, 142], [-2, 141],
    ],
  },
];

// ─── Water body exclusion polygons ───
// These are checked against isLand to remove false positives in major bodies of water.

const WATER_EXCLUSIONS: [number, number][][] = [
  // Hudson Bay
  [
    [63, -94], [63, -85], [61, -80], [58, -79], [56, -80],
    [54, -82], [52, -84], [53, -88], [56, -89], [58, -93],
    [60, -93], [63, -94],
  ],
  // Gulf of Mexico
  [
    [30, -90], [28, -86], [26, -83], [24, -84], [22, -86],
    [20, -90], [19, -94], [20, -96], [23, -97], [26, -97],
    [28, -95], [30, -90],
  ],
  // Mediterranean Sea (center portion)
  [
    [42, 6], [42, 12], [40, 16], [38, 18], [36, 16],
    [35, 20], [34, 24], [33, 28], [31, 32], [33, 34],
    [36, 32], [38, 26], [40, 22], [42, 18], [44, 12],
    [44, 6], [42, 6],
  ],
  // Bay of Bengal
  [
    [22, 86], [21, 90], [18, 93], [14, 95], [10, 97],
    [8, 96], [6, 94], [8, 90], [12, 88], [16, 86],
    [20, 86], [22, 86],
  ],
  // Sea of Japan / East Sea
  [
    [51, 135], [50, 138], [48, 140], [45, 141], [42, 140],
    [40, 139], [38, 138], [36, 137], [35, 134], [36, 131],
    [38, 130], [40, 131], [43, 133], [46, 134], [48, 134],
    [50, 135], [51, 135],
  ],
  // Persian Gulf
  [
    [30, 49], [29, 50], [28, 51], [26, 53], [25, 55],
    [26, 57], [28, 56], [30, 54], [30, 49],
  ],
  // Red Sea
  [
    [28, 34], [27, 37], [25, 38], [22, 38], [18, 40],
    [15, 42], [13, 43], [12, 43], [13, 42], [16, 40],
    [20, 38], [24, 36], [28, 34],
  ],
  // Caspian Sea
  [
    [47, 50], [45, 51], [43, 51], [41, 51], [39, 51],
    [37, 52], [36, 54], [38, 55], [40, 54], [42, 52],
    [44, 52], [47, 50],
  ],
  // Gulf of California (Sea of Cortez)
  [
    [32, -117], [30, -115], [28, -113], [26, -111], [24, -110],
    [24, -113], [26, -114], [28, -115], [30, -117], [32, -117],
  ],
  // Baltic Sea (rough)
  [
    [65, 18], [64, 22], [62, 26], [60, 28], [58, 26],
    [56, 22], [55, 18], [57, 16], [60, 18], [62, 18],
    [65, 18],
  ],
  // Black Sea
  [
    [46, 32], [45, 34], [43, 36], [42, 39], [41, 41],
    [42, 43], [44, 41], [46, 38], [46, 32],
  ],
  // Andaman Sea
  [
    [18, 92], [16, 95], [14, 96], [12, 97], [10, 97],
    [8, 96], [6, 95], [8, 93], [12, 92], [16, 92], [18, 92],
  ],
  // Caribbean Sea (between Cuba and South America)
  [
    [18, -76], [16, -74], [14, -72], [12, -70], [10, -68],
    [10, -72], [12, -75], [14, -78], [16, -80], [18, -78],
    [18, -76],
  ],
  // Gulf of Aden
  [
    [14, 44], [12, 46], [12, 50], [14, 52], [14, 50],
    [14, 46], [14, 44],
  ],
  // South China Sea (center)
  [
    [22, 110], [20, 114], [16, 116], [12, 114], [10, 112],
    [8, 110], [8, 114], [12, 116], [16, 118], [20, 116],
    [22, 112], [22, 110],
  ],
  // Bering Sea (between Alaska and Russia, rough)
  [
    [64, -175], [62, -178], [58, -175], [56, -168],
    [55, -162], [56, -160], [58, -163], [60, -168],
    [62, -172], [64, -175],
  ],
];

// ─── Ray-casting point-in-polygon ───

function pointInPolygon(lat: number, lng: number, vertices: [number, number][]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i][0], yi = vertices[i][1];
    const xj = vertices[j][0], yj = vertices[j][1];
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Land detection for pixel dots (consistent with DotMatrixGlobe + water exclusions) ───

function isFlatMapLand(lat: number, lng: number): boolean {
  if (!isLand(lat, lng)) return false;
  // Exclude known water bodies
  for (const water of WATER_EXCLUSIONS) {
    if (pointInPolygon(lat, lng, water)) return false;
  }
  return true;
}

// ─── Convert polygon vertices to SVG path string ───

function polygonToSvgPath(vertices: [number, number][]): string {
  if (vertices.length === 0) return '';
  const pts = vertices.map(([lat, lng]) => {
    const x = (180 + lng).toFixed(1);
    const y = (90 - lat).toFixed(1);
    return `${x},${y}`;
  });
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
}

// ─── Generate SVG continent paths from polygon data ───

const CONTINENT_PATHS = LAND_POLYGONS.map((poly) => ({
  d: polygonToSvgPath(poly.vertices),
  className: poly.name,
}));

// ─── Grid lines for the flat map ───

function MapGrid({ isDark = false }: { isDark?: boolean }) {
  const gridColor = isDark ? '#1f1f1f' : '#e5e5e5';
  const equatorColor = isDark ? '#333333' : '#d4d4d4';
  const lines: JSX.Element[] = [];

  // Latitude lines every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = 50 - (lat / 180) * 100;
    lines.push(
      <line
        key={`lat-${lat}`}
        x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
        stroke={gridColor} strokeWidth="0.3" strokeDasharray="2,2"
      />
    );
  }

  // Longitude lines every 30°
  for (let lng = -180; lng <= 150; lng += 30) {
    const x = 50 + (lng / 360) * 100;
    lines.push(
      <line
        key={`lng-${lng}`}
        x1={`${x}%`} y1="5%" x2={`${x}%`} y2="95%"
        stroke={gridColor} strokeWidth="0.3" strokeDasharray="2,2"
      />
    );
  }

  // Equator
  lines.push(
    <line
      key="equator"
      x1="0%" y1="50%" x2="100%" y2="50%"
      stroke={equatorColor} strokeWidth="0.5"
    />
  );

  return <g>{lines}</g>;
}

// ─── Convert lat/lng to SVG coordinates in viewBox (0-360 x 0-180) ───

function toSvgCoord(lat: number, lng: number): { x: number; y: number } {
  return {
    x: 180 + lng,
    y: 90 - lat,
  };
}

// ─── Main Component ───

export default function FlatMap({
  trajectories = [],
  onTrajectoryClick,
  focusTrajectoryId,
  className = '',
  isDark = false,
}: FlatMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Compute viewBox when a trajectory is focused
  const viewBox = useMemo(() => {
    if (focusTrajectoryId) {
      const traj = trajectories.find((t) => t.id === focusTrajectoryId);
      if (traj && traj.locations.length > 0) {
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        for (const loc of traj.locations) {
          minLng = Math.min(minLng, loc.lng);
          maxLng = Math.max(maxLng, loc.lng);
          minLat = Math.min(minLat, loc.lat);
          maxLat = Math.max(maxLat, loc.lat);
        }
        const padding = 20;
        const cx = (minLng + maxLng) / 2;
        const cy = (minLat + maxLat) / 2;
        const w = Math.max((maxLng - minLng) + padding * 2, 40);
        const h = Math.max((maxLat - minLat) + padding * 2, 30);
        return `${180 + cx - w / 2} ${90 - cy - h / 2} ${w} ${h}`;
      }
    }
    return '0 0 360 180';
  }, [focusTrajectoryId, trajectories]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <svg
        viewBox={viewBox}
        className="w-full h-full"
        style={{ background: isDark ? '#0a0a0a' : '#fafafa' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean background dots (pixel grid) */}
        <defs>
          <pattern id="ocean-dots" width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.3" fill={isDark ? '#1a1a1a' : '#e8e8e8'} />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#ocean-dots)" />

        {/* Grid */}
        <MapGrid isDark={isDark} />

        {/* Landmass shapes (from polygon data) */}
        <g fill={isDark ? '#262626' : '#d4d4d4'} stroke={isDark ? '#404040' : '#bbb'} strokeWidth="0.3">
          {CONTINENT_PATHS.map((path, i) => (
            <path key={i} d={path.d} />
          ))}
        </g>

        {/* Pixel landmass overlay using consistent land detection */}
        <PixelLandDots isDark={isDark} />

        {/* Trajectories */}
        {trajectories.map((traj) => {
          const sorted = [...traj.locations].sort((a, b) => a.order - b.order);
          const isFocused = traj.id === focusTrajectoryId;
          const isHovered = traj.id === hoveredId;

          return (
            <g
              key={traj.id}
              onClick={() => onTrajectoryClick?.(traj)}
              onMouseEnter={() => setHoveredId(traj.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Connecting lines */}
              {sorted.length >= 2 && (
                <polyline
                  points={sorted
                    .map((loc) => {
                      const { x, y } = toSvgCoord(loc.lat, loc.lng);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={traj.color}
                  strokeWidth={isFocused ? 1.5 : isHovered ? 1.2 : 0.8}
                  strokeOpacity={isFocused ? 0.9 : 0.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Location dots */}
              {sorted.map((loc, idx) => {
                const { x, y } = toSvgCoord(loc.lat, loc.lng);
                const isFirst = idx === 0;
                const isLast = idx === sorted.length - 1;
                const r = isFirst || isLast ? 2.5 : 1.5;

                return (
                  <g key={loc.id || idx}>
                    {/* Glow ring for start/end */}
                    {(isFirst || isLast) && (
                      <circle
                        cx={x} cy={y} r={r + 2}
                        fill={traj.color} opacity={0.15}
                      />
                    )}
                    {/* Outer ring */}
                    {(isFirst || isLast) && (
                      <circle
                        cx={x} cy={y} r={r + 0.8}
                        fill="none" stroke={traj.color}
                        strokeWidth="0.5" strokeOpacity={0.5}
                      />
                    )}
                    {/* Main dot */}
                    <circle
                      cx={x} cy={y} r={r}
                      fill={traj.color}
                      stroke={isDark ? '#0a0a0a' : 'white'}
                      strokeWidth="0.5"
                      filter={isFocused || isHovered ? 'url(#glow)' : undefined}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Map title — pixel font style */}
      <div
        className="absolute top-3 left-3 pointer-events-none select-none"
        style={{
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: isDark ? '#555555' : '#a0a0a0',
          opacity: 0.7,
        }}
      >
        Flat Map
      </div>

      {/* Map attribution */}
      <div className="absolute bottom-2 left-2 text-[9px] text-neutral-300 dark:text-neutral-600 pointer-events-none font-mono">
        Equirectangular Projection
      </div>
    </div>
  );
}

// ─── Pixel-style land dots using consistent land detection (same as DotMatrixGlobe + water exclusions) ───

function PixelLandDots({ isDark = false }: { isDark?: boolean }) {
  const dots = useMemo(() => {
    const result: { cx: number; cy: number }[] = [];
    const step = 3.6; // Every ~3.6 degrees

    for (let lat = -70; lat <= 75; lat += step) {
      for (let lng = -180; lng <= 180; lng += step) {
        if (isFlatMapLand(lat, lng)) {
          const { x, y } = toSvgCoord(lat, lng);
          result.push({ cx: x, cy: y });
        }
      }
    }
    return result;
  }, []);

  return (
    <g>
      {dots.map((dot, i) => (
        <rect
          key={i}
          x={dot.cx - 0.6}
          y={dot.cy - 0.6}
          width={1.2}
          height={1.2}
          fill={isDark ? '#525252' : '#a3a3a3'}
          opacity={0.5}
          rx={0.2}
        />
      ))}
    </g>
  );
}
