import { NextRequest } from 'next/server';
import { body, failure, json, user } from '@/lib/media/http';
import { parseProject } from '@/lib/media/model';
import { saveProject } from '@/lib/media/repository';
export async function POST(req: NextRequest) { try { const account = await user(req, true); return json(await saveProject(account.id, parseProject(await body(req))), 201); } catch (error) { return failure(error); } }
