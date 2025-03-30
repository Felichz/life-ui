import React from "react";
import { SystemContextProvider } from "./contexts/SystemContext";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import Footer from "./components/Footer";

const App: React.FC = () => {
  return (
    <SystemContextProvider>
      <div className="app-container">
        <Header />
        <MainContent />
        <Footer />
      </div>
    </SystemContextProvider>
  );
};

export default App;
