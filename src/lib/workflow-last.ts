export async function rememberLastWorkflow(workflowId: string | null | undefined) {
  if (!workflowId)
    return

  try {
    await fetch('/api/workflows/last', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId }),
    })
  }
  catch {
    // non-blocking
  }
}
