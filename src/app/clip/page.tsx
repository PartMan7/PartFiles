import { redirect } from 'next/navigation';

export default function ClipUploadPage() {
	redirect('/upload?tab=share');
}
