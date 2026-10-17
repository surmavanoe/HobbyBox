import { View } from "react-native";

import { Text } from "@/components/ui/Text";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text variant="title" className="mb-3 text-center">
        Your app will live here
      </Text>
      <Text className="text-center text-muted-foreground">Ask Lovable to build it</Text>
    </View>
  );
}
