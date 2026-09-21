export type Category = 'Citadine' | 'Compacte' | 'SUV' | 'Berline'

export interface PhotoCredit {
  author: string
  source: string
  license: string
  licenseUrl: string
}

export interface Vehicle {
  id: string
  brand: string
  model: string
  category: Category
  year: number
  city: string
  transmission: 'Manuelle' | 'Automatique'
  fuel: 'Essence' | 'Diesel' | 'Hybride'
  seats: number
  dailyPrice: number
  image: string
  description: string
  availability: 'À confirmer'
  photoCredit: PhotoCredit
}
