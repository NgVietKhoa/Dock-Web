import { useState } from 'react';
import { answerLogin, logins } from '../browser';

// Site asking for a username/password over HTTP (router pages, intranet…), like Chrome's sign-in box.
// key: each request starts with empty boxes
export function Login() {
  return logins[0] ? <LoginBox key={logins[0].id} host={logins[0].host} realm={logins[0].realm} /> : null;
}

function LoginBox({ host, realm }: { host: string; realm: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div id="login">
      <form
        onSubmit={(e) => { e.preventDefault(); answerLogin(username, password); }}
        onKeyDown={(e) => { if (e.key === 'Escape') answerLogin(); }}
      >
        <b>Đăng nhập vào {host}</b>
        {realm && <small>{realm}</small>}
        <input placeholder="Tên đăng nhập" autoFocus spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div>
          <button type="button" onClick={() => answerLogin()}>Huỷ</button>
          <button className="on">Đăng nhập</button>
        </div>
      </form>
    </div>
  );
}
