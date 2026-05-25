import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import type { TimeBlock, ActivityInstance, UUID } from '../../../types';
import type { ActivityInstanceWithTitle } from './KanbanBoard';
import { KanbanCardComp } from './KanbanCard';

export interface KanbanColumnProps {
    block: TimeBlock;
    activities: ActivityInstanceWithTitle[];
    onEditActivity?: (activity: ActivityInstance) => void;
    onActivateActivity?: (activityId: UUID) => void;
    onCompleteActivity?: (activityId: UUID) => void;
    onInterruptActivity?: (activityId: UUID) => void;
    isDayActive: boolean;
    isTimeBlockAvailable: (blockId: UUID) => boolean;
}

const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const KanbanColumnComp: React.FC<KanbanColumnProps> = ({
    block,
    activities,
    onEditActivity,
    onActivateActivity,
    onCompleteActivity,
    onInterruptActivity,
    isDayActive,
    isTimeBlockAvailable,
}) => {
    return (
        <div className="qc-kanban-column">
            <div className="qc-kanban-column-header">
                <h3 className="qc-kanban-column-title">{block.name}</h3>
                {!block.isDefault && (
                    <span className="qc-kanban-column-time">
                        {formatTime(block.startMinute)} - {formatTime(block.endMinute)}
                    </span>
                )}
            </div>

            <Droppable droppableId={block.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`qc-kanban-column-body scrollbar-hide ${snapshot.isDraggingOver ? 'drag-over' : ''
                            }`}
                    >
                        {activities.length === 0 ? (
                            <div className="qc-kanban-column-empty">
                                {snapshot.isDraggingOver ? 'Drop here to move' : 'No activities in this block'}
                            </div>
                        ) : (
                            activities.map((activity, index) => (
                                <KanbanCardComp
                                    key={activity.id}
                                    activity={activity}
                                    templateTitle={activity.templateTitle}
                                    index={index}
                                    onEdit={onEditActivity}
                                    onActivate={onActivateActivity}
                                    onComplete={onCompleteActivity}
                                    onInterrupt={onInterruptActivity}
                                    isDayActive={isDayActive}
                                    isTimeBlockAvailable={isTimeBlockAvailable(block.id)}
                                />
                            ))
                        )}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
};
