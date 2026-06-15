'use client'

import WorkflowCanvas from '@/components/canvas/workflow-canvas'
import VideoHistoryModal from '@/components/canvas/video-history-modal'
import RunLogPanel from '@/components/canvas/run-log-panel'
import StudioHeader from '@/components/studio-header'
import TaskQueuePanel from '@/components/task-queue-panel'
import WorkflowAutoSave from '@/components/workflow-auto-save'
import WorkflowTabs from '@/components/workflow-tabs'

const HEADER_HEIGHT = '3.5rem' /* h-14 */

export default function StudioPage() {
  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <StudioHeader />
      <main
        className="flex h-full flex-col overflow-hidden"
        style={{ paddingTop: HEADER_HEIGHT }}
      >
        <WorkflowTabs />
        <div className="relative z-0 isolate min-h-0 flex-1 overflow-hidden">
          <WorkflowCanvas />
        </div>
        <RunLogPanel />
      </main>
      <VideoHistoryModal />
      <TaskQueuePanel />
      <WorkflowAutoSave />
    </div>
  )
}
