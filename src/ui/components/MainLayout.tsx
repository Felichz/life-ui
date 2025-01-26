import React from "react";

import { ScrollArea } from "./shadcn/scroll-area";
import { TestModeBar } from "./TestModeBar";

import BoardsColumn from "@/ui/components/BoardsColumn";
import NotificationsFeed from "@/ui/components/NotificationsFeed";
import TimelineHeader from "@/ui/components/TimelineHeader";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

const MainLayout: React.FC = () => {
  const { uiState } = useUiStateContext();

  return (
    <div className="min-h-screen bg-background">
      <TestModeBar />
      <div className="flex flex-col h-[calc(100vh-44px)]">
        {/* Sección Superior: Timeline y Datos */}
        <div className="w-full p-4 border-b">
          <TimelineHeader />
        </div>

        {uiState.currentDay && (
          /* Sección Principal: Tableros y Notificaciones */
          <div className="flex flex-1 overflow-hidden">
            {/* Columna Izquierda: Tableros */}
            <ScrollArea className="flex-grow h-[calc(100vh-8rem)] min-w-0">
              <div className="p-4 border-r">
                <BoardsColumn />
              </div>
            </ScrollArea>

            {/* Columna Derecha: Notificaciones */}
            <div className="w-80 max-w-[30%] min-w-[250px]">
              <NotificationsFeed />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
