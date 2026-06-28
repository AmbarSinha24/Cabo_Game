import RoomClient from './RoomClient';

export default async function RoomPage({ params }) {
  const resolvedParams = await params;
  return <RoomClient code={resolvedParams.code} />;
}
