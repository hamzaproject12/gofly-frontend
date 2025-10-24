import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, X } from "lucide-react"

interface DeleteConfirmationProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  itemName: string
  loading?: boolean
  isHardDelete?: boolean
}

export function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  loading = false,
  isHardDelete = false
}: DeleteConfirmationProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <Card className="relative w-full max-w-md mx-4 border-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <CardHeader className="text-center pb-4">
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isHardDelete ? 'bg-red-100' : 'bg-orange-100'
          }`}>
            <AlertTriangle className={`h-6 w-6 ${
              isHardDelete ? 'text-red-600' : 'text-orange-600'
            }`} />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            {title}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className={`border rounded-lg p-4 ${
            isHardDelete 
              ? 'bg-red-50 border-red-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <p className={`text-sm font-medium ${
              isHardDelete ? 'text-red-800' : 'text-orange-800'
            }`}>
              Élément à supprimer :
            </p>
            <p className={`text-sm mt-1 ${
              isHardDelete ? 'text-red-700' : 'text-orange-700'
            }`}>
              "{itemName}"
            </p>
          </div>
          
          <div className={`border rounded-lg p-3 ${
            isHardDelete 
              ? 'bg-red-50 border-red-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className={`text-xs ${
              isHardDelete ? 'text-red-800' : 'text-yellow-800'
            }`}>
              {isHardDelete 
                ? '🚨 ATTENTION : Cette action est IRRÉVERSIBLE et supprimera DÉFINITIVEMENT toutes les données associées.'
                : '⚠️ Cette action masquera l\'élément de la liste. Les données seront préservées.'
              }
            </p>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              onClick={onConfirm}
              className={`flex-1 text-white ${
                isHardDelete 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {isHardDelete ? 'Suppression définitive...' : 'Suppression...'}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {isHardDelete ? 'Supprimer définitivement' : 'Supprimer'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
        
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
          disabled={loading}
        >
          <X className="h-4 w-4" />
        </Button>
      </Card>
    </div>
  )
}
