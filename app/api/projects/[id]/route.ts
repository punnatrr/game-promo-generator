import { NextRequest } from 'next/server';
import { failure, json, user } from '@/lib/media/http';
import { id } from '@/lib/media/model';
import { deleteProject } from '@/lib/media/repository';
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const account = await user(req, true); await deleteProject(account.id, id((await params).id)); return json({ deleted: true }); } catch (error) { return failure(error); } }
