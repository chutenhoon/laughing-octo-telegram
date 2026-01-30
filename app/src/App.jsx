import React from "react";
import { Routes, Route } from "react-router-dom";
import LegacyFrame from "./LegacyFrame.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<LegacyFrame />} />
    </Routes>
  );
}
