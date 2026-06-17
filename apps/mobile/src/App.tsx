import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DashboardScreen } from "./screens/DashboardScreen";
import { FinanceScreen } from "./screens/FinanceScreen";
import { SalesScreen } from "./screens/SalesScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: "#3b82f6",
          headerStyle: { backgroundColor: "#fff" },
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Finanzas" component={FinanceScreen} />
        <Tab.Screen name="Ventas" component={SalesScreen} />
        <Tab.Screen name="Reportes" component={ReportsScreen} />
        <Tab.Screen name="Config" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
