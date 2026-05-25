import React from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanColumnComp } from './KanbanColumn';
import type { TimeBlock, ActivityInstance, UUID } from '../../../types';
import './Kanban.css';

export interface ActivityInstanceWithTitle extends ActivityInstance {
    templateTitle: string;
}

export interface TimeBlockWithActivities {
    block: TimeBlock;
    activities: ActivityInstanceWithTitle[];
}

export interface KanbanBoardProps {
    columns: TimeBlockWithActivities[];
    onDragEnd: (result: DropResult) => void;
    onEditActivity?: (activity: ActivityInstance) => void;
    onActivateActivity?: (activityId: UUID) => void;
    onCompleteActivity?: (activityId: UUID) => void;
    onInterruptActivity?: (activityId: UUID) => void;
    isDayActive: boolean;
    isTimeBlockAvailable: (blockId: UUID) => boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
    columns,
    onDragEnd,
    onEditActivity,
    onActivateActivity,
    onCompleteActivity,
    onInterruptActivity,
    isDayActive,
    isTimeBlockAvailable,
}) => {
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="qc-kanban-board scrollbar-hide">
                {columns.length > 0 ? (
                    columns.map((column) => (
                        <KanbanColumnComp
                            key={column.block.id}
                            block={column.block}
                            activities={column.activities}
                            onEditActivity={onEditActivity}
                            onActivateActivity={onActivateActivity}
                            onCompleteActivity={onCompleteActivity}
                            onInterruptActivity={onInterruptActivity}
                            isDayActive={isDayActive}
                            isTimeBlockAvailable={isTimeBlockAvailable}
                        />
                    ))
                ) : (
                    <div className="qc-kanban-empty">
                        <p>No time blocks defined for today.</p>
                    </div>
                )}
            </div>
        </DragDropContext>
    );
};
