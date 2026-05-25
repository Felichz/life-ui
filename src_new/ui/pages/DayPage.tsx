import React, { useMemo } from 'react';
import { useSystemCore } from '../hooks/useSystemCore';
import { KanbanBoard, TimeBlockWithActivities, ActivityInstanceWithTitle } from '../components/Kanban/KanbanBoard';
import { DropResult } from '@hello-pangea/dnd';
import { ActivityInstanceModal } from '../modals/ActivityInstanceModal';
import { InterruptionModal } from '../modals/InterruptionModal';
import TimelineContainer from '../containers/TimelineContainer';
import type { UUID } from '../../types';

export const DayPage: React.FC = () => {
    const core = useSystemCore();
    const { state } = core;
    const [editingActivityId, setEditingActivityId] = React.useState<UUID | null>(null);
    const [interruptingActivityId, setInterruptingActivityId] = React.useState<UUID | null>(null);

    // Memoize columns to prevent unnecessary re-rendering during drag
    const columns: TimeBlockWithActivities[] = useMemo(() => {
        if (!state.currentDay) return [];

        // Create base columns from global blocks
        const cols: Record<string, TimeBlockWithActivities> = {};

        // Ensure "Por Hacer" holds all unmatched items
        const defaultBlock = state.global.timeBlocks.find(b => b.isDefault);

        state.global.timeBlocks.forEach(block => {
            cols[block.id] = { block, activities: [] };
        });

        // Populate activities into their blocks
        state.currentDay.activityInstances.forEach(instance => {
            const template = state.global.activityTemplates.find(t => t.id === instance.templateId);
            const enrichedInstance = {
                ...instance,
                templateTitle: template?.title || 'Unknown Activity'
            };

            if (cols[instance.blockId]) {
                cols[instance.blockId].activities.push(enrichedInstance);
            } else if (defaultBlock) {
                // Fallback to default block if original block was deleted
                cols[defaultBlock.id].activities.push(enrichedInstance);
            }
        });

        // Sort activities by order within columns
        Object.values(cols).forEach(col => {
            col.activities.sort((a: ActivityInstanceWithTitle, b: ActivityInstanceWithTitle) => a.order - b.order);
        });

        // Return array of columns sorted chronologically (default first, then by time)
        return Object.values(cols).sort((a, b) => {
            if (a.block.isDefault) return -1;
            if (b.block.isDefault) return 1;
            return a.block.startMinute - b.block.startMinute;
        });
    }, [state.currentDay, state.global.timeBlocks, state.global.activityTemplates]);

    const handleDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        // Use moveActivityInstance to perform the Kanban drag move
        core.moveActivityInstance(draggableId, destination.droppableId, destination.index);
    };

    return (
        <div style={{ padding: '0 2rem 2rem 2rem' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2rem 0 1rem 0' }}>
                <h1 className="text-gradient">Day Overview</h1>
            </div>

            <TimelineContainer />

            <KanbanBoard
                columns={columns}
                onDragEnd={handleDragEnd}
                onEditActivity={(activity) => setEditingActivityId(activity.id)}
                isDayActive={core.isDayActive()}
                isTimeBlockAvailable={core.isTimeBlockAvailable}
                onActivateActivity={core.activateActivity}
                onCompleteActivity={core.completeActivity}
                onInterruptActivity={(id: string) => setInterruptingActivityId(id)}
            />

            <ActivityInstanceModal
                activityId={editingActivityId}
                onClose={() => setEditingActivityId(null)}
            />

            <InterruptionModal
                activityId={interruptingActivityId}
                onClose={() => setInterruptingActivityId(null)}
            />
        </div>
    );
};
