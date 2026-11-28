import argon2 from 'argon2';

const password = process.env.ADMIN_PASSWORD_TO_HASH;

if (!password || password.length < 12) {
  console.error('Set ADMIN_PASSWORD_TO_HASH to a password of at least 12 characters, then run npm run admin:hash.');
  process.exit(1);
}

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

console.log('\nADMIN_PASSWORD_HASH_B64=' + Buffer.from(hash).toString('base64'));
