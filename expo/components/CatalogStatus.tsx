import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";

export function CatalogStatus() {
  const { catalogLoading, catalogError, reloadCatalog } = useStore();
  if (catalogLoading) return (
    <View className="gap-3 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-row gap-3">
          <View className="h-[96px] w-[64px] rounded-lg bg-muted" />
          <View className="flex-1 gap-3 py-2">
            <View className="h-[18px] w-3/4 rounded bg-muted" />
            <View className="h-[12px] w-1/3 rounded bg-muted" />
            <View className="h-[12px] w-full rounded bg-muted" />
          </View>
        </View>
      ))}
    </View>
  );
  if (catalogError) return (
    <View className="gap-2 px-4 py-3">
      <Text className="text-foreground">Couldn't load the media catalog.</Text>
      <Button variant="tinted" onPress={() => void reloadCatalog()}>Retry</Button>
    </View>
  );
  return null;
}