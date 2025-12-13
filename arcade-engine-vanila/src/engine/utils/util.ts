export const util = {
    ds: {
        array: {
            /**
             * Randomizes (shuffles) an array using the Fisher-Yates algorithm.
             * Returns a new array, leaving the original unmodified.
             */
            randomise: <T>(data: T[]): T[] => {
                const array = [...data];
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            },
            /**
             * Picks a random item from the array that is different from the last picked item.
             */
            pickRandomNoRepeat: <T>(data: T[], lastPicked: T | null): T => {
                if (data.length === 0) throw new Error("Array is empty");
                if (data.length === 1) return data[0];
                
                let item: T;
                do {
                    item = data[Math.floor(Math.random() * data.length)];
                } while (item === lastPicked);
                return item;
            }
        }
    }
};