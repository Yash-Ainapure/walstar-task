import React, { createContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { setLogoutFunction } from "../api/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This function runs when the app starts
    const bootstrapAsync = async () => {
      let userToken;
      let userData;

      try {
        // Retrieve the token and user data from storage
        userToken = await SecureStore.getItemAsync("userToken");
        const userString = await SecureStore.getItemAsync("userData");
        userData = userString ? JSON.parse(userString) : null;

        if (userToken && userData) {
          // If we have a token and user, update the state
          setToken(userToken);
          setUser(userData);
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Restoring token failed", e);
      } finally {
        // Hide splash screen or loading indicator
        setIsLoading(false);
      }
    };

    bootstrapAsync();
    
    // Register logout function with API module
    setLogoutFunction(logout);
  }, []);

  const login = async (token, user) => {
    try {
      // Store both the token and the user object
      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userData", JSON.stringify(user));
      
      setToken(token);
      setUser(user);
      setIsLoggedIn(true);
    } catch (error) {
        console.error("Failed to save auth data", error);
    }
  };

  const logout = async () => {
    try {
      // Remove both token and user data
      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userData");

      setToken(null);
      setUser(null);
      setIsLoggedIn(false);
    } catch (error) {
        console.error("Failed to clear auth data", error);
    }
  };

  // Render a loading indicator while we check for the token
  if (isLoading) {
    return null; // Or a loading spinner component
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout, user, setUser, token }}>
      {children}
    </AuthContext.Provider>
  );
};