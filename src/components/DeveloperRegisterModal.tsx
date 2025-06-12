import React, { useState } from 'react';
import TONConnectButton from './TONConnectButton';

interface DeveloperRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: { wallet: string; email: string; name: string }) => void;
}

const DeveloperRegisterModal: React.FC<DeveloperRegisterModalProps> = ({ isOpen, onClose, onRegister }) => {
  const [wallet, setWallet] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleWalletConnect = (address: string) => {
    setWallet(address);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!wallet) return setError('Connect your TON Wallet!');
    if (!email) return setError('Enter your email!');
    if (!name) return setError('Enter your name!');
    if (!agree) return setError('You must agree to the rules!');
    onRegister({ wallet, email, name });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black">✕</button>
        <h2 className="text-2xl font-bold mb-4 text-center">Регистрация разработчика</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center">
            <TONConnectButton onConnect={handleWalletConnect} />
            {wallet && <div className="mt-2 text-xs text-green-600">Wallet: {wallet.slice(0, 8)}...{wallet.slice(-8)}</div>}
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-3 border rounded"
          />
          <input
            type="text"
            placeholder="Имя"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-3 border rounded"
          />
          <label className="flex items-center text-sm">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mr-2" />
            Я согласен с правилами платформы
          </label>
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          {success && <div className="text-green-500 text-sm text-center">Добро пожаловать, разработчик!</div>}
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 transition">Зарегистрироваться</button>
        </form>
      </div>
    </div>
  );
};

export default DeveloperRegisterModal;