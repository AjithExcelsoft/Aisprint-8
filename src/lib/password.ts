const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
	return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(
	password: string,
	salt: Uint8Array,
	iterations = PBKDF2_ITERATIONS,
): Promise<ArrayBuffer> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	return crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: new Uint8Array(salt),
			iterations,
			hash: "SHA-256",
		},
		keyMaterial,
		KEY_LENGTH * 8,
	);
}

export async function hashPassword(plainPassword: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const hash = new Uint8Array(await deriveKey(plainPassword, salt));

	return `${bytesToBase64(salt)}:${PBKDF2_ITERATIONS}:${bytesToBase64(hash)}`;
}

export async function verifyPassword(
	plainPassword: string,
	storedHash: string,
): Promise<boolean> {
	const [saltBase64, iterationsValue, hashBase64] = storedHash.split(":");
	if (!saltBase64 || !iterationsValue || !hashBase64) {
		return false;
	}

	const iterations = Number(iterationsValue);
	if (!Number.isInteger(iterations) || iterations <= 0) {
		return false;
	}

	const salt = base64ToBytes(saltBase64);
	const expectedHash = base64ToBytes(hashBase64);
	const actualHash = new Uint8Array(
		await deriveKey(plainPassword, salt, iterations),
	);

	if (actualHash.length !== expectedHash.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < actualHash.length; index++) {
		diff |= actualHash[index]! ^ expectedHash[index]!;
	}

	return diff === 0;
}
