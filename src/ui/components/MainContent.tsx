import React from "react";
import { useSystem } from "../contexts/SystemContext";
import KanbanBoard from "./KanbanBoard";
import SubjectiveStatePanel from "./SubjectiveStatePanel";
import QuickAccessBar from "./QuickAccessBar";
import VisualizationPanel from "./VisualizationPanel";

const MainContent: React.FC = () => {
  const system = useSystem();

  return (
    <main className="main-content">
      <div className="top-row">
        <QuickAccessBar />
      </div>
      <div className="content-grid">
        <div className="kanban-section">
          <KanbanBoard />
        </div>
        <div className="side-panels">
          <SubjectiveStatePanel />
          <VisualizationPanel />
        </div>
      </div>
    </main>
  );
};

export default MainContent;
