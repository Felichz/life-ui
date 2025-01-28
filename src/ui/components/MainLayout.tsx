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
    <div className="min-h-screen bg-background flex flex-col">
      <TestModeBar />
      <div className="flex flex-col flex-1">
        {/* Sección Superior: Timeline y Datos */}
        <div className="w-full p-4 border-b shrink-0">
          <TimelineHeader />
        </div>

        {uiState.currentDay && (
          /* Sección Principal: Tableros y Notificaciones */
          <div className="flex flex-1 min-h-0">
            {/* Columna Izquierda: Tableros */}
            <div className="flex-grow border-r min-w-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <BoardsColumn />
                </div>
              </ScrollArea>
            </div>

            {/* Columna Derecha: Notificaciones */}
            <div className="w-80 max-w-[30%] min-w-[250px] min-h-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <NotificationsFeed />
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
