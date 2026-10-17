import { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";

import { formatYearRange, MAX_RELEASE_YEAR, MIN_RELEASE_YEAR, moveYearHandle, type YearRange } from "@/lib/searchFilters";

interface Props { value: YearRange | null; onChange: (value: YearRange) => void }

export function YearRangeSlider({ value, onChange }: Props) {
  const range: YearRange = value ?? [MIN_RELEASE_YEAR, MAX_RELEASE_YEAR];
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<0 | 1 | null>(null);
  const track = useRef<View>(null);
  const trackLeft = useRef(0);
  const current = useRef({ range, onChange, width });
  current.current = { range, onChange, width };
  const drag = useRef<{ handle: 0 | 1 | null; year: number; x: number; range: YearRange }>({ handle: null, year: MIN_RELEASE_YEAR, x: 0, range });
  const span = MAX_RELEASE_YEAR - MIN_RELEASE_YEAR;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const { range: initial, width: trackWidth } = current.current;
      if (trackWidth <= 44) return;
      const year = MIN_RELEASE_YEAR + ((event.nativeEvent.pageX - trackLeft.current - 22) / (trackWidth - 44)) * span;
      const handle = initial[0] === initial[1] ? null : Math.abs(year - initial[0]) <= Math.abs(year - initial[1]) ? 0 : 1;
      drag.current = { handle, year: initial[handle ?? 0], x: trackLeft.current + 22, range: initial };
      setActive(handle);
    },
    onPanResponderMove: (event) => {
      const { width: trackWidth, onChange: change } = current.current;
      if (trackWidth <= 44) return;
      const year = MIN_RELEASE_YEAR + ((event.nativeEvent.pageX - drag.current.x) / (trackWidth - 44)) * span;
      if (drag.current.handle === null && Math.abs(year - drag.current.year) < 0.5) return;
      const handle = drag.current.handle ?? (year < drag.current.year ? 0 : 1);
      drag.current.handle = handle;
      setActive(handle);
      change(moveYearHandle(drag.current.range, handle, year));
    },
    onPanResponderRelease: (event) => {
      const { width: trackWidth, onChange: change } = current.current;
      if (drag.current.handle !== null && trackWidth > 44) {
        const year = MIN_RELEASE_YEAR + ((event.nativeEvent.pageX - drag.current.x) / (trackWidth - 44)) * span;
        change(moveYearHandle(drag.current.range, drag.current.handle, year));
      }
      setActive(null);
    },
    onPanResponderTerminate: () => setActive(null),
  }), [span]);

  return (
    <View className="px-2 pt-8">
      <Text accessibilityLiveRegion="polite" className="text-center text-3xl font-bold text-primary">{formatYearRange(range)}</Text>
      <View ref={track} {...responder.panHandlers} onLayout={(event) => { setWidth(event.nativeEvent.layout.width); track.current?.measureInWindow((x) => { trackLeft.current = x; }); }} className="relative mt-6 h-[56px]" testID="year-range-track">
        <View pointerEvents="none" className="absolute left-[22px] right-[22px] top-[26px] h-[4px] rounded-full bg-muted" />
        <View pointerEvents="none" className="absolute top-[26px] h-[4px] rounded-full bg-primary" style={{ left: 22 + ((range[0] - MIN_RELEASE_YEAR) / span) * Math.max(0, width - 44), width: ((range[1] - range[0]) / span) * Math.max(0, width - 44) }} />
        {([0, 1] as const).map((handle) => (
          <View key={handle} pointerEvents="none" accessible accessibilityRole="adjustable" accessibilityLabel={handle === 0 ? "Start year" : "End year"} accessibilityValue={{ min: handle === 0 ? MIN_RELEASE_YEAR : range[0], max: handle === 0 ? range[1] : MAX_RELEASE_YEAR, now: range[handle] }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(event) => onChange(moveYearHandle(range, handle, range[handle] + (event.nativeEvent.actionName === "increment" ? 1 : -1)))} className="absolute top-[6px] h-[44px] w-[44px] items-center justify-center" style={{ left: ((range[handle] - MIN_RELEASE_YEAR) / span) * Math.max(0, width - 44) }}>
            <View className={active === handle ? "h-[24px] w-[24px] rounded-full border-2 border-foreground bg-primary" : "h-[20px] w-[20px] rounded-full bg-primary"} />
          </View>
        ))}
      </View>
      <View className="flex-row justify-between px-[22px]">
        <Text className="text-sm text-muted-foreground">{MIN_RELEASE_YEAR}</Text>
        <Text className="text-sm text-muted-foreground">{MAX_RELEASE_YEAR}</Text>
      </View>
    </View>
  );
}