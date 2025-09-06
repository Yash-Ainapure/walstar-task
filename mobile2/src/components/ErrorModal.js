import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

const ErrorModal = ({ visible, message, onClose }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            width: "80%",
            backgroundColor: "white",
            padding: 20,
            borderRadius: 10,
          }}
        >
          <Text style={{ fontSize: 16, marginBottom: 10, color: "red" }}>
            Error
          </Text>
          <Text style={{ marginBottom: 20 }}>{message}</Text>
          <TouchableOpacity
            style={{
              backgroundColor: "red",
              padding: 10,
              borderRadius: 5,
              alignSelf: "flex-end",
            }}
            onPress={onClose}
          >
            <Text style={{ color: "white" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ErrorModal;
