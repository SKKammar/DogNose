import EditDogClient from './EditDogClient'

export default async function EditDogPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  return <EditDogClient id={resolvedParams.id} />
}
