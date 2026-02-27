// web/src/components/SettingsModal.jsx
import { useState, useEffect } from 'react'

export function SettingsModal({ isOpen, onClose, config }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  
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
    setIsVerifying(true)

    try {
      // Hash the password using Web Crypto API
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Compare with environment variable
      const expectedHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH
      
      console.log('🔍 Debug Info:')
      console.log('Hash gerado:', hashHex)
      console.log('Hash esperado:', expectedHash || 'NÃO CONFIGURADO')
      console.log('Match:', hashHex === expectedHash)
      
      if (!expectedHash) {
        setPasswordError('❌ Variável VITE_ADMIN_PASSWORD_HASH não configurada no build')
        setShowDebug(true)
        return
      }

      if (hashHex === expectedHash) {
        setIsAuthenticated(true)
        setPassword('')
        setPasswordError('')
      } else {
        setPasswordError('❌ Senha incorreta. Verifique o console (F12) para debug.')
        setShowDebug(true)
      }
    } catch (error) {
      console.error('Erro ao validar senha:', error)
      setPasswordError('❌ Erro ao validar senha: ' + error.message)
    } finally {
      setIsVerifying(false)
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
                  disabled={isVerifying}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                  autoFocus
                />
                {passwordError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}
                {showDebug && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800 font-mono">
                      💡 Dica: Abra o Console (F12) para ver informações de debug
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Hash esperado está configurado: {import.meta.env.VITE_ADMIN_PASSWORD_HASH ? '✅ Sim' : '❌ Não'}
                    </p>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isVerifying || !password}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Verificando...</span>
                  </>
                ) : (
                  'Entrar'
                )}
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
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSaving ? '⏳ Salvando...' : '💾 Salvar Configurações'}
                </button>
                
                <a
                  href="https://github.com/mvmvasconcelos/ifva-on-the-line/actions/workflows/test-email.yml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  📨 Testar E-mail no GitHub Actions
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-sm text-blue-900 font-semibold">
                  💡 Como usar:
                </p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li><strong>Salvar:</strong> Atualmente, edite manualmente o arquivo <code className="bg-blue-100 px-1 rounded">data/status.json</code></li>
                  <li><strong>Testar E-mail:</strong> Clique no botão acima, depois em "Run workflow" → "Run workflow"</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
