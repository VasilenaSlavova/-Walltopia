import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Masthead from "./components/Masthead";
import Calculator from "./pages/Calculator";
import Dashboard from "./pages/Dashboard";

function DocumentationRedirect({ section }) {
  const target = `/technical-documentation.html#${section}`;
  useEffect(() => { window.location.replace(target); }, [target]);
  return <main className="reader"><p>Opening <a href={target}>Technical Documentation</a>…</p></main>;
}

export default function App() {
  return (
    <>
      <Masthead />
      <Routes>
        <Route path="/" element={<Calculator />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/manual" element={<DocumentationRedirect section="application-manual" />} />
        <Route path="/attachment" element={<DocumentationRedirect section="attachment-details" />} />
        <Route path="*" element={<Calculator />} />
      </Routes>
    </>
  );
}
