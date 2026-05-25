import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { ActivityInstance, UUID } from '../../../types';
import { Card, CardContent } from '../Card';
import { Button } from '../Button';

export interface KanbanCardProps {
    activity: ActivityInstance;
    templateTitle: string;
    index: number;
    onEdit?: (activity: ActivityInstance) => void;
    onActivate?: (activityId: UUID) => void;
    onComplete?: (activityId: UUID) => void;
    onInterrupt?: (activityId: UUID) => void;
    isDayActive: boolean;
    isTimeBlockAvailable: boolean;
}

export const KanbanCardComp: React.FC<KanbanCardProps> = ({
    activity,
    templateTitle,
    index,
    onEdit,
    onActivate,
    onComplete,
    onInterrupt,
    isDayActive,
    isTimeBlockAvailable,
}) => {

    const renderDuration = () => {
        if (activity.clearObjectiveSettings) {
            return `~${activity.clearObjectiveSettings.estimatedDurationMinutes}m`;
        } else if (activity.flexibleDurationSettings) {
            return `${activity.flexibleDurationSettings.minimumDurationMinutes}-${activity.flexibleDurationSettings.maximumDurationMinutes}m`;
        } else if (activity.timeboxingSettings) {
            if (activity.timeboxingSettings.type === 'minimum-time') {
                return `≥${activity.timeboxingSettings.minimumDurationMinutes}m`;
            } else if (activity.timeboxingSettings.type === 'maximum-time') {
                return `≤${activity.timeboxingSettings.maximumDurationMinutes}m`;
            }
            return `${activity.timeboxingSettings.minimumDurationMinutes}-${activity.timeboxingSettings.maximumDurationMinutes}m`;
        }
        return '';
    };

    return (
        <Draggable draggableId={activity.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`qc-kanban-draggable ${snapshot.isDragging ? 'dragging' : ''}`}
                >
                    <Card
                        variant={activity.state === 'active' ? 'interactive' : 'glass'}
                        padding="sm"
                        style={{
                            borderLeft: activity.state === 'active' ? '3px solid var(--success)' : undefined
                        }}
                    >
                        <CardContent>
                            <div className="qc-kanban-card-header">
                                <h4 className="qc-kanban-card-title">{templateTitle}</h4>
                                <button
                                    className="qc-kanban-card-edit"
                                    onClick={(e) => { e.stopPropagation(); onEdit?.(activity); }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                </button>
                            </div>

                            <div className="qc-kanban-card-meta">
                                <span className={`qc-status-badge qc-status-${activity.state}`}>
                                    {activity.state}
                                </span>
                                <span className="qc-duration-text">{renderDuration()}</span>
                            </div>

                            {/* Actions */}
                            <div className="qc-kanban-card-actions">
                                {activity.state === 'active' && isDayActive && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            style={{ flex: 1, backgroundColor: 'var(--success)' }}
                                            onClick={(e) => { e.stopPropagation(); onComplete?.(activity.id); }}
                                        >
                                            Done
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            style={{ flex: 1 }}
                                            onClick={(e) => { e.stopPropagation(); onInterrupt?.(activity.id); }}
                                        >
                                            Stop
                                        </Button>
                                    </>
                                )}

                                {activity.state === 'instantiated' && isDayActive && (
                                    <Button
                                        size="sm"
                                        variant={isTimeBlockAvailable ? 'primary' : 'secondary'}
                                        disabled={!isTimeBlockAvailable}
                                        fullWidth
                                        onClick={(e) => { e.stopPropagation(); onActivate?.(activity.id); }}
                                    >
                                        Start
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </Draggable>
    );
};
