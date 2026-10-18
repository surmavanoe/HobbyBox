import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cover, Stars } from "@/components/hb";
import { Button } from "@/components/ui/Button";
import { mediaById } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

export function RecentReviewsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { myLogs, openLog } = useStore();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-background/80">
        <View className="max-h-[85%] rounded-t-lg border-t border-border bg-background">
          <View className="flex-row items-center px-4 py-2">
            <Text className="flex-1 text-lg font-bold text-foreground">Last Reviewed</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close reviews" className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <FlatList data={myLogs.filter((log) => !!mediaById(log.mediaId)?.cover)} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }} ListEmptyComponent={
            <View className="py-4"><Text className="text-muted-foreground">Your reviews will show up here.</Text><Button variant="tinted" className="mt-3" onPress={() => { onClose(); openLog(); }}>Log your first title</Button></View>
          } renderItem={({ item }) => {
            const media = mediaById(item.mediaId);
            if (!media) return null;
            return (
              <Pressable onPress={() => { onClose(); openLog(media.id); }} className="min-h-[44px] flex-row items-start gap-3 border-b border-border py-3">
                <Cover media={media} className="h-[108px] w-[72px]" rounded="rounded-lg" />
                <View className="flex-1 gap-2">
                  <Text className="font-bold text-foreground">{media.title}</Text>
                  <Stars value={item.rating} showValue />
                  <Text className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</Text>
                  {item.review ? <Text className="text-sm text-foreground">{item.review}</Text> : null}
                </View>
              </Pressable>
            );
          }} />
        </View>
      </View>
    </Modal>
  );
}