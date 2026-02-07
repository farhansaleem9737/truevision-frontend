import { View, Text, Pressable } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>
        Home Screen
      </Text>

      <Pressable
        onPress={() => navigation.navigate("Profile")}
        style={{
          marginTop: 20,
          backgroundColor: "black",
          padding: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: "white" }}>Go to Profile</Text>
      </Pressable>
    </View>
  );
}
