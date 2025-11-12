// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Widget from "./pages/Widget";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:slug" element={<Widget />} />
      </Routes>
    </BrowserRouter>
  );
}

