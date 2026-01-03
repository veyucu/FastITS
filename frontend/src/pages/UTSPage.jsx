import { useNavigate } from 'react-router-dom'
import { Stethoscope, Home } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'

const UTSPage = () => {
    usePageTitle('UTS İşlemleri')
    const navigate = useNavigate()

    return (
        <div className="flex flex-col h-screen bg-dark-950">
            {/* Header */}
            <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
                <div className="px-4 py-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/')}
                            className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
                            title="Ana Menü"
                        >
                            <Home className="w-5 h-5 text-slate-300" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-600 rounded flex items-center justify-center shadow-lg shadow-teal-600/30">
                                <Stethoscope className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-lg font-bold text-slate-100">UTS İşlemleri</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                    <Stethoscope className="w-16 h-16 text-teal-400/50 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-300 mb-2">UTS İşlemleri</h2>
                    <p className="text-slate-500">Bu sayfa yakında aktif olacak.</p>
                </div>
            </div>
        </div>
    )
}

export default UTSPage
