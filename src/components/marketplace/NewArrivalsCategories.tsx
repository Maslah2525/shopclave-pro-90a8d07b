import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import barakazIcon from "@/assets/barakaz-icon.webp";
import electronicsImg from "@/assets/categories/electronics.webp";
import fashionImg from "@/assets/categories/fashion.webp";
import homeGardenImg from "@/assets/categories/home-garden.webp";
import healthBeautyImg from "@/assets/categories/health-beauty.webp";
import sportsImg from "@/assets/categories/sports.webp";
import phonesTabletsImg from "@/assets/categories/phones-tablets.webp";
import automotiveImg from "@/assets/categories/automotive.webp";
import booksImg from "@/assets/categories/books.webp";
import { categoryBrowsePath } from "@/lib/categoryBrowsing";

const FALLBACK_IMAGES: Record<string, string> = {
  electronics: electronicsImg,
  fashion: fashionImg,
  "fashion-clothing": fashionImg,
  "home-garden": homeGardenImg,
  "home-and-garden": homeGardenImg,
  home: homeGardenImg,
  "health-beauty": healthBeautyImg,
  "health-and-beauty": healthBeautyImg,
  beauty: healthBeautyImg,
  sports: sportsImg,
  "sports-fitness": sportsImg,
  "sports-and-fitness": sportsImg,
  fitness: sportsImg,
  "phones-tablets": phonesTabletsImg,
  "phones-and-tablets": phonesTabletsImg,
  phones: phonesTabletsImg,
  tablets: phonesTabletsImg,
  automotive: automotiveImg,
  cars: automotiveImg,
  vehicles: automotiveImg,
  books: booksImg,
  shoes: fashionImg,
  watches: fashionImg,
  jewelry: fashionImg,
  "travel-and-luggage": fashionImg,
  "bags-and-accessories": fashionImg,
  "fabric-and-tailoring": fashionImg,
};

const NewArrivalsCategories = ({ newArrivals = true }: { newArrivals?: boolean }) => {
  const { data: categories } = useQuery({
    queryKey: ["new-arrivals-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .is("parent_id", null)
        .order("name")
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  if (!categories?.length) return null;

  return (
    <section className="container py-6" aria-label={newArrivals ? "New Arrivals" : "Shop by Category"}>
      <h2 className="font-display text-lg md:text-xl font-bold text-foreground mb-4">
        {newArrivals ? "New Arrivals" : "Shop by Category"}
      </h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {categories.map((c: any) => (
          <Link
            key={c.id}
            to={categoryBrowsePath(c.slug, newArrivals)}
            className="group flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-marketplace-orange-light transition-colors"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-secondary border-2 border-border group-hover:border-primary transition-colors">
              <img
                src={c.image_url || FALLBACK_IMAGES[c.slug] || barakazIcon}
                alt={c.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <span className="text-xs md:text-sm font-medium text-center text-foreground line-clamp-2">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default NewArrivalsCategories;
