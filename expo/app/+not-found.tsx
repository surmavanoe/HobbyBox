import { Link, Stack } from "expo-router";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text variant="title" className="mb-4">
          Page not found
        </Text>
        <Link href="/" asChild>
          <Pressable className="min-h-[44px] min-w-[44px] items-center justify-center px-4">
            <Text className="text-primary underline">Go to home screen</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
