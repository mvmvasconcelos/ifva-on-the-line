// web/src/components/SettingsModal.jsx
import { useState, useEffect } from 'react'

export function SettingsModal({ isOpen, onClose, config }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  
  // Config state
  const [emails, setEmails] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  useEffect(() => {
    if (config) {
      setEmails(config.alert_emails?.join(', ') || '')
      setEmailSubject(config.email_template?.subject || '')
      setEmailBody(config.email_template?.body || '')
    }
  }, [config])

  useEffect(() => {
    if (!isOpen) {
      setIsAuthenticated(false)
      setPassword('')
      setPasswordError('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')

    try {
      // Hash the password using Web Crypto API
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Compare with environment variable or hardcoded hash
      const expectedHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH
      
      if (!expectedHash) {
        setPasswordError('Configuração de senha não encontrada')
        return
      }

      if (hashHex === expectedHash) {
        setIsAuthenticated(true)
        setPassword('')
      } else {
        setPasswordError('Senha incorreta')
      }
    } catch (error) {
      setPasswordError('Erro ao validar senha')
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const emailList = emails.split(',').map(e => e.trim()).filter(e => e)
      
      const updatedConfig = {
        alert_emails: emailList,
        email_template: {
          subject: emailSubject,
          body: emailBody
        }
      }

      // In a real implementation, this would commit to GitHub via API
      // For now, we'll just show a success message
      console.log('Saving config:', updatedConfig)
      
      alert('⚠️ Funcionalidade de salvamento via API ainda não implementada.\n\nPor enquanto, você pode editar manualmente o arquivo data/status.json.')
      
    } catch (error) {
      alert('Erro ao salvar configurações: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestEmail = async () => {
    setIsTesting(true)
    try {
      // This would trigger the test_email workflow via GitHub API
      const response = await fetch(`https://api.github.com/repos/${import.meta.env.VITE_GITHUB_REPO}/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'Authorization': `token ${import.meta.env.VITE_GITHUB_TOKEN}`
        },
        body: JSON.stringify({
          event_type: 'test_email'
        })
      })

      if (response.ok || response.status === 204) {
        alert('✅ E-mail de teste disparado! Verifique sua caixa de entrada em alguns minutos.')
      } else {
        throw new Error('Falha ao disparar e-mail de teste')
      }
    } catch (error) {
      alert('❌ Erro ao disparar e-mail de teste: ' + error.message)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            ⚙️ Configurações Avançadas
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isAuthenticated ? (
            // Password form
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔒 Digite a senha de administrador
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  autoFocus
                />
                {passwordError && (
                  <p className="mt-2 text-sm text-red-600">{passwordError}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Entrar
              </button>
            </form>
          ) : (
            // Settings form
            <div className="space-y-6">
              {/* Email List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📧 Lista de E-mails para Alertas
                </label>
                <input
                  type="text"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Separe múltiplos e-mails por vírgula
                </p>
              </div>

              {/* Email Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📬 Assunto do E-mail
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="⚠️ ALERTA: Sistema Offline"
                />
              </div>

              {/* Email Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Corpo do E-mail
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Mensagem do alerta..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Variáveis disponíveis: {'{last_seen}'}, {'{elapsed_time}'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Salvando...' : '💾 Salvar Configurações'}
                </button>
                <button
                  onClick={handleTestEmail}
                  disabled={isTesting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTesting ? 'Enviando...' : '📨 Testar E-mail'}
                </button>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Nota:</strong> As configurações são salvas diretamente no repositório GitHub via API. 
                  O e-mail de teste dispara o workflow <code className="bg-yellow-100 px-1 rounded">test-email.yml</code>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
