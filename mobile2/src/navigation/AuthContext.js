import React, { createContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { setLogoutFunction } from "../api/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const logout = async () => {
    await SecureStore.deleteItemAsync("userToken");
    setIsLoggedIn(false);
    setUser(null);
    setToken(null);
  };

  useEffect(() => {
    const checkToken = async () => {
      const token = await SecureStore.getItemAsync("userToken");
      setIsLoggedIn(!!token);
    };
    checkToken();
    
    // Register logout function with API module for session expiry handling
    setLogoutFunction(logout);
  }, []);

  const login = async (token,user) => {
    await SecureStore.setItemAsync("userToken", token);
    setIsLoggedIn(true);
    setUser(user);
    setToken(token);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout, user, setUser,token }}>
      {children}
    </AuthContext.Provider>
  );
};
